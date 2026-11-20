// Package sessions implementa o pareamento entre computador e iPhone.
//
// Fluxo: o computador cria uma sessão e recebe um código de 6 dígitos (uma única
// sessão aguardando por vez). O iPhone envia id + código. Acertando, recebe um
// token de sessão. Cinco erros bloqueiam a sessão. Código e sessão são de uso único.
package sessions

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"sync"
	"time"

	"icam/signaling-server/internal/security"
)

// Erros de domínio. A camada HTTP traduz para códigos estáveis.
var (
	ErrNotFound      = errors.New("sessão não encontrada")
	ErrExpired       = errors.New("sessão expirada")
	ErrLocked        = errors.New("sessão bloqueada por tentativas excedidas")
	ErrAlreadyPaired = errors.New("sessão já pareada")
	ErrWrongCode     = errors.New("código incorreto")
)

// State é o estado observável de uma sessão.
type State string

const (
	StateWaiting State = "waiting"
	StatePaired  State = "paired"
	StateExpired State = "expired"
	StateLocked  State = "locked"
)

// Config controla prazos e limites. Now permite testes determinísticos.
type Config struct {
	SessionTTL  time.Duration
	TokenTTL    time.Duration
	MaxAttempts int
	Now         func() time.Time
}

// DefaultConfig: 5 min para parear, 12 h de token, 5 tentativas.
func DefaultConfig() Config {
	return Config{
		SessionTTL:  5 * time.Minute,
		TokenTTL:    12 * time.Hour,
		MaxAttempts: 5,
		Now:         time.Now,
	}
}

// Created é o retorno de Create. O código é mostrado uma única vez no computador.
type Created struct {
	ID          string
	PairingCode string
	ExpiresAt   time.Time
}

// PairResult é o retorno de Pair. O token nunca é armazenado em claro.
type PairResult struct {
	Token          string
	TokenExpiresAt time.Time
}

// Status é a visão da sessão para o computador.
type Status struct {
	State        State
	AttemptsLeft int
	ExpiresAt    time.Time
}

type session struct {
	id          string
	code        string
	expiresAt   time.Time
	attempts    int
	state       State
	tokenHash   [32]byte
	tokenExpiry time.Time
}

// Manager guarda sessões em memória. Nada é gravado em disco.
type Manager struct {
	mu       sync.Mutex
	cfg      Config
	sessions map[string]*session
}

// NewManager valida a configuração e cria o gerenciador.
func NewManager(cfg Config) (*Manager, error) {
	if cfg.SessionTTL <= 0 || cfg.TokenTTL <= 0 {
		return nil, errors.New("TTLs devem ser positivos")
	}
	if cfg.MaxAttempts < 1 {
		return nil, errors.New("MaxAttempts deve ser pelo menos 1")
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &Manager{cfg: cfg, sessions: make(map[string]*session)}, nil
}

// Create abre uma nova sessão e descarta as que ainda aguardavam pareamento.
func (m *Manager) Create() (Created, error) {
	id, err := security.NewSessionID()
	if err != nil {
		return Created{}, err
	}
	code, err := security.PairingCode()
	if err != nil {
		return Created{}, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for k, s := range m.sessions {
		if s.state == StateWaiting {
			delete(m.sessions, k)
		}
	}

	s := &session{
		id:        id,
		code:      code,
		expiresAt: m.cfg.Now().Add(m.cfg.SessionTTL),
		state:     StateWaiting,
	}
	m.sessions[id] = s
	return Created{ID: id, PairingCode: code, ExpiresAt: s.expiresAt}, nil
}

// Pair valida id e código. Em caso de sucesso, a sessão vira "paired" e o código deixa de valer.
func (m *Manager) Pair(id, code string) (PairResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[id]
	if !ok {
		return PairResult{}, ErrNotFound
	}
	m.refresh(s)

	switch s.state {
	case StateExpired:
		return PairResult{}, ErrExpired
	case StateLocked:
		return PairResult{}, ErrLocked
	case StatePaired:
		return PairResult{}, ErrAlreadyPaired
	}

	if subtle.ConstantTimeCompare([]byte(code), []byte(s.code)) != 1 {
		s.attempts++
		if s.attempts >= m.cfg.MaxAttempts {
			s.state = StateLocked
			return PairResult{}, ErrLocked
		}
		return PairResult{}, ErrWrongCode
	}

	token, err := security.RandomToken(32)
	if err != nil {
		return PairResult{}, err
	}
	s.tokenHash = sha256.Sum256([]byte(token))
	s.tokenExpiry = m.cfg.Now().Add(m.cfg.TokenTTL)
	s.state = StatePaired
	s.code = "" // uso único

	return PairResult{Token: token, TokenExpiresAt: s.tokenExpiry}, nil
}

// Status devolve o estado atual de uma sessão para o computador.
func (m *Manager) Status(id string) (Status, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[id]
	if !ok {
		return Status{}, ErrNotFound
	}
	m.refresh(s)
	left := m.cfg.MaxAttempts - s.attempts
	if left < 0 {
		left = 0
	}
	return Status{State: s.state, AttemptsLeft: left, ExpiresAt: s.expiresAt}, nil
}

// ValidateToken confere um token de sessão. Comparação em tempo constante sobre o hash.
func (m *Manager) ValidateToken(token string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	h := sha256.Sum256([]byte(token))
	now := m.cfg.Now()
	for _, s := range m.sessions {
		if s.state == StatePaired && now.Before(s.tokenExpiry) &&
			subtle.ConstantTimeCompare(h[:], s.tokenHash[:]) == 1 {
			return true
		}
	}
	return false
}

// refresh aplica expiração por tempo. Sessões pareadas expiram pelo prazo do token.
func (m *Manager) refresh(s *session) {
	now := m.cfg.Now()
	switch s.state {
	case StateWaiting:
		if !now.Before(s.expiresAt) {
			s.state = StateExpired
			s.code = ""
		}
	case StatePaired:
		if !now.Before(s.tokenExpiry) {
			s.state = StateExpired
		}
	}
}
