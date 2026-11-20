// Comando gencert: cria a CA local e o certificado HTTPS do servidor.
//
//	go run ./cmd/gencert -certs ./certs -hosts localhost,192.168.0.10
//
// Os IPs da máquina são incluídos automaticamente. Use -hosts para acrescentar outros.
// Gera: ca.crt (DER, para instalar no iPhone), ca.pem, server.crt, server.key.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"icam/signaling-server/internal/certs"
)

func main() {
	dir := flag.String("certs", "./certs", "diretório de saída")
	hostsFlag := flag.String("hosts", "localhost,127.0.0.1", "hosts extras, separados por vírgula")
	flag.Parse()

	hosts := map[string]bool{}
	for _, h := range strings.Split(*hostsFlag, ",") {
		if h = strings.TrimSpace(h); h != "" {
			hosts[h] = true
		}
	}
	for _, ip := range certs.LANIPv4() {
		hosts[ip] = true
	}
	list := make([]string, 0, len(hosts))
	for h := range hosts {
		list = append(list, h)
	}

	bundle, err := certs.Generate(time.Now(), list)
	if err != nil {
		log.Fatalf("falha ao gerar certificados: %v", err)
	}

	if err := os.MkdirAll(*dir, 0o700); err != nil {
		log.Fatal(err)
	}
	files := map[string][]byte{
		"ca.crt":     bundle.CADER,
		"ca.pem":     bundle.CAPEM,
		"server.crt": bundle.ServerPEM,
		"server.key": bundle.ServerKey,
	}
	for name, data := range files {
		if err := os.WriteFile(filepath.Join(*dir, name), data, 0o600); err != nil {
			log.Fatal(err)
		}
	}

	fmt.Printf("Certificados gravados em %s\n", *dir)
	fmt.Printf("Hosts no certificado: %s\n", strings.Join(list, ", "))
	fmt.Println("Instale ca.crt no iPhone e ative a confiança total (ver docs/SECURITY.md).")
}
