package board

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/arduino/arduino-app-cli/pkg/board"
	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"app-lab-desktop/internal/tunnel"
)

const (
	arduinoQFqbn          = "arduino:zephyr:unoq"
	orchestratorTunnelTag = "orchestrator"
	boardOrchestratorPort = 8800
)

// This type is needed to avoid Wails name clash during JS bindings generation.
// Without this, the type github.com/arduino/arduino-app-cli/pkg/board.Board is lost
// in the generated models.ts file.
type BoardInfo board.Board

type KeyboardLayout struct {
	Description string `json:"label"`
	LayoutId    string `json:"id"`
}

func (b BoardInfo) ToApiBoard() *board.Board {
	board := board.Board(b)
	return &board
}

type Board struct {
	Id      string            `json:"id"`
	Info    BoardInfo         `json:"info"`
	Conn    remote.RemoteConn `json:"-"`
	tunnels []tunnel.Tunnel
}

func New(source *board.Board) (*Board, error) {
	var id string
	if source != nil {
		var err error
		id, err = hashStruct(source)
		if err != nil {
			return nil, fmt.Errorf("failed to hash board struct: %w", err)
		}
	}

	var info BoardInfo
	if source != nil {
		info = BoardInfo(*source)
	}

	return &Board{
		Id:      id,
		Info:    info,
		Conn:    NoopConn(),
		tunnels: nil,
	}, nil
}

func Noop() *Board {
	noop, _ := New(nil)
	return noop
}

func hashStruct(v any) (string, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("failed to marshal struct: %w", err)
	}

	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:]), nil
}

func (b *Board) StartTunnel(ctx context.Context, conn remote.RemoteConn, tag string, targetBoardPort int) (tunnel.Tunnel, error) {
	for _, t := range b.tunnels {
		if p, err := t.Port(); err != nil && p == targetBoardPort {
			// @TODO: If needed by future requirements, close existing tunnel here and create a new one.
			// Or allow multiple tunnels to the same port.
			return t, nil
		}
	}

	t, err := tunnel.New(ctx, conn, tag, targetBoardPort)
	if err != nil {
		return nil, fmt.Errorf("failed to start tunnel: %w", err)
	}

	b.tunnels = append(b.tunnels, t)
	return t, nil
}

func (b *Board) CloseTunnels(ctx context.Context) {
	if b.tunnels == nil || len(b.tunnels) == 0 {
		runtime.LogInfof(ctx, "tunnels already closed")
	}

	for _, t := range b.tunnels {
		if err := t.Close(ctx); err != nil {
			runtime.LogErrorf(ctx, "failed to close tunnel: %v", err)
		}
	}
	b.tunnels = nil
}

func (b *Board) EstablishConnection(ctx context.Context, optPassword string) error {
	apiBoard := b.Info.ToApiBoard()
	var conn remote.RemoteConn

	switch apiBoard.Protocol {
	case board.SerialProtocol:
		var err error
		conn, err = apiBoard.GetConnection()
		if err != nil {
			return fmt.Errorf("failed to connect to board: %w", err)
		}
		if _, err := b.StartTunnel(ctx, conn, orchestratorTunnelTag, boardOrchestratorPort); err != nil {
			return fmt.Errorf("failed to start tunnel: %w", err)
		}

	case board.NetworkProtocol:
		var err error
		if optPassword == "" {
			return fmt.Errorf("password is required to connect to network protocol board")
		}
		conn, err = apiBoard.GetConnection(optPassword)
		if err != nil {
			return fmt.Errorf("failed to connect to board: %w", err)
		}
		if _, err := b.StartTunnel(ctx, conn, orchestratorTunnelTag, boardOrchestratorPort); err != nil {
			return fmt.Errorf("failed to start tunnel: %w", err)
		}

	case board.LocalProtocol:
		var err error
		conn, err = apiBoard.GetConnection()
		if err != nil {
			return fmt.Errorf("failed to connect to board: %w", err)
		}

	default:
		return fmt.Errorf("unsupported board protocol: %s", apiBoard.Protocol)
	}

	b.Conn = conn
	return nil
}

func (b *Board) GetName(ctx context.Context) (string, error) {
	return board.GetCustomName(ctx, b.Conn)
}

func (b *Board) SetName(ctx context.Context, name string) error {
	return board.SetCustomName(ctx, b.Conn, name)
}

func (b *Board) IsUserPasswordSet(ctx context.Context) (bool, error) {
	return board.IsUserPasswordSet(b.Conn)
}

func (b *Board) SetUserPassword(ctx context.Context, password string) error {
	return board.SetUserPassword(ctx, b.Conn, password)
}

func (b *Board) GetKeyboardLayout(ctx context.Context) (string, error) {
	return board.GetKeyboardLayout(ctx, b.Conn)
}

func (b *Board) ListKeyboardLayouts() ([]KeyboardLayout, error) {
	boardLayouts, err := board.ListKeyboardLayouts(b.Conn)
	if err != nil {
		return nil, err
	}
	layouts := make([]KeyboardLayout, len(boardLayouts))
	for i, bl := range boardLayouts {
		layouts[i] = KeyboardLayout{
			Description: bl.Description,
			LayoutId:    bl.LayoutId,
		}
	}
	return layouts, nil
}

func (b *Board) SetKeyboardLayout(ctx context.Context, layoutCode string) error {
	return board.SetKeyboardLayout(ctx, b.Conn, layoutCode)
}

func (b *Board) GetNetworkModeStatus(ctx context.Context) (bool, error) {
	return board.NetworkModeStatus(ctx, b.Conn)
}

func (b *Board) EnableNetworkMode(ctx context.Context) error {
	return board.EnableNetworkMode(ctx, b.Conn)
}

func (b *Board) DisableNetworkMode(ctx context.Context) error {
	return board.DisableNetworkMode(ctx, b.Conn)
}

func (b *Board) GetOrchestratorURL() (string, error) {
	if len(b.tunnels) == 0 {
		return "", fmt.Errorf("no active tunnels")
	}

	var port int
	for _, t := range b.tunnels {
		if t.Tag() == "orchestrator" {
			p, err := t.Port()
			if err != nil {
				return "", fmt.Errorf("failed to get orchestrator tunnel port: %w", err)
			}
			port = p
			break
		}
	}

	if port == 0 {
		return "", fmt.Errorf("no orchestrator tunnel found")
	}
	return fmt.Sprintf("http://localhost:%d", port), nil
}

func (b *Board) IsR0Build() bool {
	return board.GetOSImageVersion(b.Conn) == board.R0_IMAGE_VERSION_ID
}

// GetOSImageVersion returns the OS image version of the board.
// It will return R0 image version in case of any error.
func (b *Board) GetOSImageVersion() string {
	return board.GetOSImageVersion(b.Conn)
}

func (b *Board) GetKernelVersion(ctx context.Context) (string, error) {
	cmd := b.Conn.GetCmd("uname", "-r")
	out, err := cmd.Output(ctx)
	if err != nil {
		return "", fmt.Errorf("output failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func (b *Board) GetLinuxDistribution() (string, error) {
	f, err := b.Conn.ReadFile("/etc/os-release")
	if err != nil {
		return "", fmt.Errorf("failed to read os-release file: %w", err)
	}

	s := bufio.NewScanner(f)
	for s.Scan() {
		line := s.Text()
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			prettyName := strings.TrimPrefix(line, "PRETTY_NAME=")
			return strings.Trim(prettyName, "\n\t\" "), nil
		}
	}

	return "", fmt.Errorf("PRETTY_NAME not found in os-release file")
}
