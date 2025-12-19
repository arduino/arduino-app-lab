package network

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

type Status string

var (
	ConnectedStatus    Status = "connected"
	ConnectingStatus   Status = "connecting"
	DisconnectedStatus Status = "disconnected"
)

func (m *Manager) GetStatusByType(ctx context.Context, netType string) (Status, error) {
	// -t = terse, -f = columns  TYPE,STATE
	out, err := m.Run(ctx, "-t", "-f", "TYPE,STATE", "device")
	if err != nil {
		return DisconnectedStatus, fmt.Errorf("failed to query devices: %w", err)
	}

	for _, line := range strings.Split(out, "\n") {
		parts := strings.Split(line, ":")
		if len(parts) != 2 {
			continue
		}
		if parts[0] == netType && strings.TrimSpace(parts[1]) == "connected" {
			return ConnectedStatus, nil
		}

		if parts[0] == netType && strings.TrimSpace(parts[1]) == "connecting" {
			return ConnectingStatus, nil
		}
	}
	return DisconnectedStatus, nil
}

func (nm *Manager) getInternetStatus(ctx context.Context) (bool, error) {
	out, err := nm.Run(ctx, "networking", "connectivity", "check")
	if err != nil {
		return false, fmt.Errorf("failed to query internet connectivity: %w", err)
	}

	return strings.TrimSpace(out) == "full", nil
}

func GetInternetStatus(ctx context.Context, conn remote.RemoteConn) (bool, error) {
	if conn == nil {
		return false, fmt.Errorf("missing connection")
	}
	nm := &Manager{
		Timeout: 5 * time.Second,
		Conn:    conn,
	}
	return nm.getInternetStatus(ctx)
}

func GetConnectionName(ctx context.Context, conn remote.RemoteConn) (*string, error) {
	if conn == nil {
		return nil, fmt.Errorf("missing connection")
	}
	nm := &Manager{
		Timeout: 5 * time.Second,
		Conn:    conn,
	}
	// -t = terse, -f = columns NAME
	out, err := nm.Run(ctx, "-t", "-f", "NAME", "connection", "show", "--active")
	if err != nil {
		return nil, fmt.Errorf("failed to query connection: %w", err)
	}
	parts := strings.Split(out, "\n")
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		return nil, nil
	}
	name := strings.TrimSpace(parts[0])
	return &name, nil
}
