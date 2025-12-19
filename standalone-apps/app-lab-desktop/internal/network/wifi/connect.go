package wifi

import (
	"app-lab-desktop/internal/network"
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// agnostic function to connect to a Wi-Fi network using nmcli
func connect(ctx context.Context, nm *network.Manager, ssid, password string) error {
	_, err := nm.Run(ctx, "radio", "wifi", "on")
	if err != nil {
		return fmt.Errorf("failed to enable Wi-Fi: %w", err)
	}

	if err := nm.RunUntilSuccess(ctx, network.RunUntilSuccessCfg{
		Command:  []string{"radio", "wifi"},
		Expected: "enabled",
		Attempts: 5,
	}); err != nil {
		return fmt.Errorf("failed to enable Wi-Fi: %w", err)
	}

	_, err = nm.Run(ctx, "device", "wifi", "rescan")
	if err != nil {
		return fmt.Errorf("failed to rescan Wi-Fi: %w", err)
	}

	if err := nm.RunUntilSuccess(ctx, network.RunUntilSuccessCfg{
		Command:  []string{"device", "wifi", "list"},
		Expected: ssid,
		Attempts: 8,
	}); err != nil {
		return fmt.Errorf("failed to list available Wi-Fi networks: %w", err)
	}

	args := []string{"--wait", "20", "device", "wifi", "connect", ssid}
	if password != "" {
		args = append([]string{"--ask"}, args...)
		args = append(args, "password", password)
	}

	if _, err := nm.Run(ctx, args...); err != nil {
		return fmt.Errorf("failed to connect to Wi-Fi %q: %w", ssid, err)
	}
	return nil
}

func Connect(ctx context.Context, conn remote.RemoteConn, ssid, password string) error {
	if conn == nil {
		return fmt.Errorf("missing connection")
	}
	if ssid == "" {
		return errors.New("ssid must not be empty")
	}

	nm := &network.Manager{
		Timeout: 60 * time.Second,
		Conn:    conn,
	}
	return connect(ctx, nm, ssid, password)
}
