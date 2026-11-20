// Comando icam-signaling: servidor de sinalização e pareamento do iCam Studio 4K.
//
//	icam-signaling -public-addr 0.0.0.0:8443 -local-addr 127.0.0.1:8080 \
//	  -static-dir ../apps/mobile-pwa/dist -certs ./certs
package main

import (
	"context"
	"crypto/tls"
	"errors"
	"flag"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"icam/signaling-server/internal/httpapi"
	"icam/signaling-server/internal/sessions"
)

func main() {
	publicAddr := flag.String("public-addr", "0.0.0.0:8443", "HTTPS para o iPhone (PWA e pareamento)")
	localAddr := flag.String("local-addr", "127.0.0.1:8080", "HTTP só de loopback para o app Desktop")
	staticDir := flag.String("static-dir", "../apps/mobile-pwa/dist", "build do PWA (npm run build)")
	certDir := flag.String("certs", "./certs", "diretório gerado por gencert")
	sessionTTL := flag.Duration("session-ttl", 5*time.Minute, "validade do código de pareamento")
	tokenTTL := flag.Duration("token-ttl", 12*time.Hour, "validade do token após o pareamento")
	flag.Parse()

	log := slog.New(slog.NewJSONHandler(os.Stderr, nil))

	if *localAddr != "" && !isLoopback(*localAddr) {
		log.Error("local-addr precisa ser loopback (127.0.0.1 ou ::1)", "addr", *localAddr)
		os.Exit(2)
	}

	cfg := sessions.DefaultConfig()
	cfg.SessionTTL = *sessionTTL
	cfg.TokenTTL = *tokenTTL
	mgr, err := sessions.NewManager(cfg)
	if err != nil {
		log.Error("configuração inválida", "err", err)
		os.Exit(2)
	}

	caDER, _ := os.ReadFile(filepath.Join(*certDir, "ca.crt"))
	tlsCert, err := tls.LoadX509KeyPair(filepath.Join(*certDir, "server.crt"), filepath.Join(*certDir, "server.key"))
	if err != nil {
		log.Error("certificados ausentes: rode `go run ./cmd/gencert` antes", "dir", *certDir, "err", err)
		os.Exit(2)
	}

	public := &http.Server{
		Addr:              *publicAddr,
		Handler:           httpapi.PublicHandler(mgr, *staticDir, caDER),
		TLSConfig:         &tls.Config{Certificates: []tls.Certificate{tlsCert}, MinVersion: tls.VersionTLS12},
		ReadHeaderTimeout: 10 * time.Second,
	}
	servers := []*http.Server{public}

	if *localAddr != "" {
		local := &http.Server{
			Addr:              *localAddr,
			Handler:           httpapi.LocalHandler(mgr),
			ReadHeaderTimeout: 10 * time.Second,
		}
		servers = append(servers, local)
		go func() {
			log.Info("API local (Desktop)", "addr", *localAddr)
			if err := local.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				log.Error("falha na API local", "err", err)
				os.Exit(1)
			}
		}()
	}

	go func() {
		log.Info("HTTPS público (iPhone)", "addr", *publicAddr, "static", *staticDir)
		if err := public.ListenAndServeTLS("", ""); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("falha no HTTPS", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, s := range servers {
		_ = s.Shutdown(ctx)
	}
	log.Info("encerrado")
}

func isLoopback(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	return host == "127.0.0.1" || host == "localhost" || host == "::1"
}
