package sessions

import (
	"errors"
	"sync"
	"testing"
	"time"
)

// clock é um relógio controlável para testes de expiração.
type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) now() time.Time { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *clock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

func newTestManager(t *testing.T) (*Manager, *clock) {
	t.Helper()
	c := &clock{t: time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)}
	m, err := NewManager(Config{
		SessionTTL:  5 * time.Minute,
		TokenTTL:    time.Hour,
		MaxAttempts: 3,
		Now:         c.now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return m, c
}

func TestPairWithCorrectCodeIssuesValidToken(t *testing.T) {
	m, _ := newTestManager(t)
	created, err := m.Create()
	if err != nil {
		t.Fatal(err)
	}

	res, err := m.Pair(created.ID, created.PairingCode)
	if err != nil {
		t.Fatalf("pareamento falhou: %v", err)
	}
	if res.Token == "" {
		t.Fatal("token vazio")
	}
	if !m.ValidateToken(res.Token) {
		t.Fatal("token recém-emitido deveria ser válido")
	}
	if m.ValidateToken("token-inventado") {
		t.Fatal("token inventado não pode ser válido")
	}
}

func TestCodeIsSingleUse(t *testing.T) {
	m, _ := newTestManager(t)
	created, _ := m.Create()
	if _, err := m.Pair(created.ID, created.PairingCode); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Pair(created.ID, created.PairingCode); !errors.Is(err, ErrAlreadyPaired) {
		t.Fatalf("segundo uso deveria ser ErrAlreadyPaired, veio %v", err)
	}
}

func TestWrongCodesLockSession(t *testing.T) {
	m, _ := newTestManager(t)
	created, _ := m.Create()
	wrong := "000000"
	if created.PairingCode == wrong {
		wrong = "111111"
	}

	if _, err := m.Pair(created.ID, wrong); !errors.Is(err, ErrWrongCode) {
		t.Fatalf("1ª tentativa: %v", err)
	}
	if _, err := m.Pair(created.ID, wrong); !errors.Is(err, ErrWrongCode) {
		t.Fatalf("2ª tentativa: %v", err)
	}
	// 3ª tentativa errada atinge MaxAttempts=3 e bloqueia.
	if _, err := m.Pair(created.ID, wrong); !errors.Is(err, ErrLocked) {
		t.Fatalf("3ª tentativa deveria bloquear: %v", err)
	}
	// Mesmo o código correto não funciona depois do bloqueio.
	if _, err := m.Pair(created.ID, created.PairingCode); !errors.Is(err, ErrLocked) {
		t.Fatalf("sessão bloqueada deveria recusar até o código certo: %v", err)
	}
	st, _ := m.Status(created.ID)
	if st.State != StateLocked || st.AttemptsLeft != 0 {
		t.Fatalf("status inesperado: %+v", st)
	}
}

func TestSessionExpiresWithoutPairing(t *testing.T) {
	m, c := newTestManager(t)
	created, _ := m.Create()
	c.advance(5 * time.Minute)

	if _, err := m.Pair(created.ID, created.PairingCode); !errors.Is(err, ErrExpired) {
		t.Fatalf("esperava ErrExpired: %v", err)
	}
}

func TestTokenExpires(t *testing.T) {
	m, c := newTestManager(t)
	created, _ := m.Create()
	res, _ := m.Pair(created.ID, created.PairingCode)

	c.advance(time.Hour)
	if m.ValidateToken(res.Token) {
		t.Fatal("token deveria ter expirado")
	}
}

func TestCreateReplacesWaitingSession(t *testing.T) {
	m, _ := newTestManager(t)
	first, _ := m.Create()
	second, _ := m.Create()

	if _, err := m.Status(first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("sessão anterior deveria ter sido descartada: %v", err)
	}
	if _, err := m.Pair(second.ID, second.PairingCode); err != nil {
		t.Fatalf("sessão nova deveria parear: %v", err)
	}
}

func TestUnknownSessionIsNotFound(t *testing.T) {
	m, _ := newTestManager(t)
	if _, err := m.Pair("nao-existe", "123456"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("esperava ErrNotFound: %v", err)
	}
}

func TestNewManagerRejectsBadConfig(t *testing.T) {
	if _, err := NewManager(Config{SessionTTL: 0, TokenTTL: time.Hour, MaxAttempts: 1}); err == nil {
		t.Fatal("TTL zero deveria ser rejeitado")
	}
	if _, err := NewManager(Config{SessionTTL: time.Minute, TokenTTL: time.Hour, MaxAttempts: 0}); err == nil {
		t.Fatal("MaxAttempts zero deveria ser rejeitado")
	}
}
