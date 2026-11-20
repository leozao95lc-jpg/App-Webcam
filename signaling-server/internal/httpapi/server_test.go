package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"icam/signaling-server/internal/sessions"
)

func newManager(t *testing.T) *sessions.Manager {
	t.Helper()
	m, err := sessions.NewManager(sessions.DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func newStatic(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sw.js"), []byte("self.x=1"), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestLocalCreateThenStatusThenPhonePairs(t *testing.T) {
	m := newManager(t)
	local := LocalHandler(m)
	public := PublicHandler(m, newStatic(t), nil)

	rec := do(t, local, http.MethodPost, "/api/sessions", "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", rec.Code, rec.Body)
	}
	var created struct {
		SessionID   string `json:"sessionId"`
		PairingCode string `json:"pairingCode"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}

	st := do(t, local, http.MethodGet, "/api/sessions/"+created.SessionID+"/status", "")
	if st.Code != http.StatusOK || !bytes.Contains(st.Body.Bytes(), []byte(`"waiting"`)) {
		t.Fatalf("status antes do pareamento: %d %s", st.Code, st.Body)
	}

	pair := do(t, public, http.MethodPost, "/api/pair",
		`{"sessionId":"`+created.SessionID+`","code":"`+created.PairingCode+`"}`)
	if pair.Code != http.StatusOK {
		t.Fatalf("pair: %d %s", pair.Code, pair.Body)
	}
	if !bytes.Contains(pair.Body.Bytes(), []byte(`"token"`)) {
		t.Fatalf("resposta sem token: %s", pair.Body)
	}
}

func TestPublicDoesNotExposeSessionCreation(t *testing.T) {
	public := PublicHandler(newManager(t), newStatic(t), nil)
	rec := do(t, public, http.MethodPost, "/api/sessions", "")
	if rec.Code != http.StatusNotFound && rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("superfície pública não pode criar sessões: %d", rec.Code)
	}
	if bytes.Contains(rec.Body.Bytes(), []byte("app")) {
		t.Fatal("resposta de criação não pode vir do PWA")
	}

	// Rota /api/ desconhecida também não pode cair no index.html.
	unknown := do(t, public, http.MethodGet, "/api/inexistente", "")
	if unknown.Code != http.StatusNotFound {
		t.Fatalf("rota /api/ desconhecida deveria ser 404, veio %d", unknown.Code)
	}
}

func TestWrongCodeReturnsAttemptsLeft(t *testing.T) {
	m := newManager(t)
	created, _ := m.Create()
	public := PublicHandler(m, newStatic(t), nil)

	rec := do(t, public, http.MethodPost, "/api/pair",
		`{"sessionId":"`+created.ID+`","code":"000000"}`)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401, veio %d", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"attemptsLeft":4`)) {
		t.Fatalf("attemptsLeft ausente ou errado: %s", rec.Body)
	}
}

func TestPairRejectsOversizedBody(t *testing.T) {
	public := PublicHandler(newManager(t), newStatic(t), nil)
	big := `{"sessionId":"` + string(bytes.Repeat([]byte("a"), 4096)) + `"}`
	rec := do(t, public, http.MethodPost, "/api/pair", big)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("corpo grande deveria ser recusado, veio %d", rec.Code)
	}
}

func TestSPAFallbackAndNoCacheForIndex(t *testing.T) {
	public := PublicHandler(newManager(t), newStatic(t), nil)

	rec := do(t, public, http.MethodGet, "/capture/abc", "")
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte("app")) {
		t.Fatalf("fallback SPA falhou: %d", rec.Code)
	}

	sw := do(t, public, http.MethodGet, "/sw.js", "")
	if sw.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("sw.js precisa de no-cache, veio %q", sw.Header().Get("Cache-Control"))
	}
}

func TestPathTraversalStaysInsideStaticDir(t *testing.T) {
	root := t.TempDir()
	static := filepath.Join(root, "dist")
	if err := os.MkdirAll(static, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(static, "index.html"), []byte("idx"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "segredo.txt"), []byte("NAO-PUBLICAR"), 0o644); err != nil {
		t.Fatal(err)
	}
	public := PublicHandler(newManager(t), static, nil)

	rec := do(t, public, http.MethodGet, "/../segredo.txt", "")
	if bytes.Contains(rec.Body.Bytes(), []byte("NAO-PUBLICAR")) {
		t.Fatal("path traversal expôs arquivo fora do diretório estático")
	}
}

func TestCACertServedOnlyWhenProvided(t *testing.T) {
	ca := []byte{0x30, 0x82}
	with := PublicHandler(newManager(t), newStatic(t), ca)
	rec := do(t, with, http.MethodGet, "/icam-ca.crt", "")
	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/x-x509-ca-cert" {
		t.Fatalf("CA não servida: %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}

func TestSecurityHeadersPresent(t *testing.T) {
	public := PublicHandler(newManager(t), newStatic(t), nil)
	rec := do(t, public, http.MethodGet, "/", "")
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" || rec.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatal("cabeçalhos de segurança ausentes")
	}
}
