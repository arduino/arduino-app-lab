package tunnel

import (
	"context"
	"errors"
	"fmt"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
	"github.com/arduino/arduino-app-cli/pkg/x/ports"
)

type Tunnel interface {
	Tag() string
	Port() (int, error)
	Close(ctx context.Context) error
}

type tunnel struct {
	tag      string
	conn     remote.RemoteConn
	hostPort int
}

var _ Tunnel = (*tunnel)(nil)

// New creates and initializes a tunnel, forwarding boardTargetPort<host>:boardTargetPort<board>.
// If boardTargetPort<host> is already in use, it will try to get and use an available port.
func New(ctx context.Context, conn remote.RemoteConn, tag string, boardTargetPort int) (
	*tunnel,
	error,
) {
	hostPort := boardTargetPort

	for {
		err := conn.Forward(ctx, hostPort, boardTargetPort)
		if err == nil {
			break
		}

		forwardErr := fmt.Errorf("failing to forward port %d->%d: %w", hostPort, boardTargetPort, err)

		if errors.Is(err, remote.ErrPortAvailable) {
			hostPort, err = ports.GetAvailable()
			if err != nil {
				return nil, errors.Join(forwardErr, fmt.Errorf("failing to get an available port: %w", err))
			}
			continue
		}

		return nil, forwardErr
	}

	return &tunnel{
		tag:      tag,
		conn:     conn,
		hostPort: hostPort,
	}, nil
}

func (t *tunnel) Tag() string {
	return t.tag
}

func (t *tunnel) Port() (int, error) {
	if t.conn == nil {
		return 0, fmt.Errorf("tunnel is not established")
	}
	return t.hostPort, nil
}

// Close removes the port forwarding and reinitializes the tunnel properties
func (t *tunnel) Close(ctx context.Context) error {
	// @TODO: close it by port when supported by the remote interface
	if err := t.conn.ForwardKillAll(ctx); err != nil {
		return fmt.Errorf("failing to kill all port forwards: %w", err)
	}

	t.conn = nil
	t.hostPort = 0

	return nil
}
