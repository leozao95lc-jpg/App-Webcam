package security

import (
	"regexp"
	"testing"
)

func TestPairingCodeIsSixDigits(t *testing.T) {
	re := regexp.MustCompile(`^[0-9]{6}$`)
	for i := 0; i < 200; i++ {
		code, err := PairingCode()
		if err != nil {
			t.Fatal(err)
		}
		if !re.MatchString(code) {
			t.Fatalf("código inválido: %q", code)
		}
	}
}

func TestRandomTokenRejectsShortInput(t *testing.T) {
	if _, err := RandomToken(8); err == nil {
		t.Fatal("esperava erro para token curto")
	}
}

func TestRandomTokensDiffer(t *testing.T) {
	a, _ := RandomToken(32)
	b, _ := RandomToken(32)
	if a == b || len(a) == 0 {
		t.Fatalf("tokens repetidos ou vazios: %q %q", a, b)
	}
}

func TestSessionIDIs32Hex(t *testing.T) {
	id, err := NewSessionID()
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(id) {
		t.Fatalf("id inválido: %q", id)
	}
}
