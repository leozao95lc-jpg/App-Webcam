// Package httpapi expõe as rotas HTTP do servidor de sinalização.
//
// Duas superfícies, separadas por socket (não por verificação de IP):
//   - Local (127.0.0.1): usada pelo app Desktop. Cria sessões e consulta status.
//     Só escuta em loopback, então não fica acessível pela rede.
//   - Pública (HTTPS na LAN): usada pelo iPhone. Serve o PWA, o certificado da CA
//     e o endpoint de pareamento. Não expõe criação de sessão.
package httpapi

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"icam/signaling-server/internal/sessions"
)

const maxBodyBytes = 1024

// LocalHandler: API do Desktop. Deve ser montado somente em listener loopback.
func LocalHandler(m *sessions.Manager) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health)
	mux.HandleFunc("POST /api/sessions", func(w http.ResponseWriter, r *http.Request) {
		created, err := m.Create()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "não foi possível criar a sessão")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"sessionId":   created.ID,
			"pairingCode": created.PairingCode,
			"expiresAt":   created.ExpiresAt.UTC().Format(time.RFC3339),
		})
	})
	mux.HandleFunc("GET /api/sessions/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		st, err := m.Status(r.PathValue("id"))
		if err != nil {
			writeError(w, http.StatusNotFound, "not_found", sessionErrMessage(err))
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"state":        st.State,
			"attemptsLeft": st.AttemptsLeft,
			"expiresAt":    st.ExpiresAt.UTC().Format(time.RFC3339),
		})
	})
	return mux
}

// PublicHandler: PWA estático, CA e pareamento para o iPhone. staticDir é o build do Vite.
// caDER, se não vazio, é servido em /icam-ca.crt para instalação no iOS.
func PublicHandler(m *sessions.Manager, staticDir string, caDER []byte) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health)
	mux.HandleFunc("POST /api/pair", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		var body struct {
			SessionID string `json:"sessionId"`
			Code      string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_body", "corpo JSON inválido")
			return
		}
		res, err := m.Pair(body.SessionID, body.Code)
		if err != nil {
			st, _ := m.Status(body.SessionID)
			switch {
			case errors.Is(err, sessions.ErrWrongCode):
				writeJSON(w, http.StatusUnauthorized, map[string]any{
					"error": "wrong_code", "message": sessionErrMessage(err), "attemptsLeft": st.AttemptsLeft,
				})
			case errors.Is(err, sessions.ErrNotFound):
				writeError(w, http.StatusNotFound, "not_found", sessionErrMessage(err))
			case errors.Is(err, sessions.ErrExpired):
				writeError(w, http.StatusGone, "expired", sessionErrMessage(err))
			case errors.Is(err, sessions.ErrLocked):
				writeError(w, http.StatusLocked, "locked", sessionErrMessage(err))
			case errors.Is(err, sessions.ErrAlreadyPaired):
				writeError(w, http.StatusConflict, "already_paired", sessionErrMessage(err))
			default:
				writeError(w, http.StatusInternalServerError, "internal", "falha no pareamento")
			}
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"token":          res.Token,
			"tokenExpiresAt": res.TokenExpiresAt.UTC().Format(time.RFC3339),
		})
	})
	if len(caDER) > 0 {
		mux.HandleFunc("GET /icam-ca.crt", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/x-x509-ca-cert")
			w.Header().Set("Content-Disposition", `attachment; filename="icam-local-ca.crt"`)
			w.Header().Set("Cache-Control", "no-store")
			_, _ = w.Write(caDER)
		})
	}
	mux.Handle("/", staticHandler(staticDir))
	return securityHeaders(mux)
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "time": time.Now().UTC().Format(time.RFC3339)})
}

// staticHandler serve arquivos do build e cai para index.html em rotas do app (SPA).
// Service worker e index nunca são cacheados pelo navegador, para que atualizações do PWA cheguem.
func staticHandler(dir string) http.Handler {
	fileServer := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// O PWA é só leitura. Métodos de escrita e rotas /api/ desconhecidas nunca caem no index.html.
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "método não permitido")
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "not_found", "rota de API inexistente")
			return
		}
		clean := filepath.Clean("/" + r.URL.Path)
		full := filepath.Join(dir, filepath.FromSlash(clean))
		info, err := os.Stat(full)
		if err == nil && !info.IsDir() {
			if strings.HasSuffix(clean, "sw.js") || strings.HasSuffix(clean, "index.html") || clean == "/" {
				w.Header().Set("Cache-Control", "no-cache")
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		if errors.Is(err, fs.ErrNotExist) || (err == nil && info.IsDir()) {
			index := filepath.Join(dir, "index.html")
			if _, statErr := os.Stat(index); statErr != nil {
				http.Error(w, "PWA não compilado: rode npm run build em apps/mobile-pwa", http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, index)
			return
		}
		http.Error(w, "erro ao ler arquivo", http.StatusInternalServerError)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Permissions-Policy", "camera=(self)")
		next.ServeHTTP(w, r)
	})
}

func sessionErrMessage(err error) string {
	switch {
	case errors.Is(err, sessions.ErrNotFound):
		return "sessão não encontrada"
	case errors.Is(err, sessions.ErrExpired):
		return "sessão expirou; gere um novo código no computador"
	case errors.Is(err, sessions.ErrLocked):
		return "sessão bloqueada; gere um novo código no computador"
	case errors.Is(err, sessions.ErrAlreadyPaired):
		return "sessão já pareada"
	case errors.Is(err, sessions.ErrWrongCode):
		return "código incorreto"
	}
	return "erro"
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
