// Package security concentra a geração de segredos do servidor de sinalização.
// Usa somente crypto/rand. Nunca usa math/rand para tokens ou códigos.
package security

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"fmt"
)

// RandomToken devolve n bytes aleatórios codificados em base64url sem padding.
func RandomToken(n int) (string, error) {
	if n < 16 {
		return "", fmt.Errorf("token com menos de 16 bytes não é aceito: %d", n)
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("falha ao ler entropia: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// PairingCodeDigits é o número de dígitos do código exibido no computador.
const PairingCodeDigits = 6

// PairingCode gera um código numérico de 6 dígitos com distribuição uniforme.
// Usa rejeição para evitar viés do módulo (2^32 não é múltiplo de 10^6).
func PairingCode() (string, error) {
	const modulus = 1_000_000
	const limit = (uint64(1) << 32) / modulus * modulus // valores acima disso são rejeitados
	var buf [4]byte
	for {
		if _, err := rand.Read(buf[:]); err != nil {
			return "", fmt.Errorf("falha ao ler entropia: %w", err)
		}
		v := uint64(binary.BigEndian.Uint32(buf[:]))
		if v < limit {
			return fmt.Sprintf("%06d", v%modulus), nil
		}
	}
}

// NewSessionID gera um identificador de sessão de 128 bits em hexadecimal.
func NewSessionID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("falha ao ler entropia: %w", err)
	}
	return fmt.Sprintf("%x", buf), nil
}
