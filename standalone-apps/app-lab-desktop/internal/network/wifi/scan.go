package wifi

import (
	"app-lab-desktop/internal/network"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

func listSSIDs(ctx context.Context, nm *network.Manager) ([]string, error) {
	if _, err := nm.Run(ctx, "radio", "wifi", "on"); err != nil {
		return nil, fmt.Errorf("failed to enable Wi-Fi: %w", err)
	}

	if err := nm.RunUntilSuccess(ctx, network.RunUntilSuccessCfg{
		Command:  []string{"radio", "wifi"},
		Expected: "enabled",
		Attempts: 5,
	}); err != nil {
		return nil, fmt.Errorf("failed to enable Wi-Fi: %w", err)
	}

	if _, err := nm.Run(ctx, "device", "wifi", "rescan"); err != nil {
		return nil, fmt.Errorf("failed to rescan Wi-Fi: %w", err)
	}

	out, err := nm.Run(ctx, "-t", "-f", "SSID", "device", "wifi", "list")
	if err != nil {
		return nil, fmt.Errorf("failed to list Wi-Fi networks: %w", err)
	}

	var (
		ssids []string
		seen  = make(map[string]struct{})
	)
	for _, line := range strings.Split(out, "\n") {
		ssid := strings.TrimSpace(line)
		if ssid == "" || ssid == "--" { // "--" is when no networks are found
			continue
		}
		if _, ok := seen[ssid]; !ok {
			seen[ssid] = struct{}{}
			ssids = append(ssids, ssid)
		}
	}
	return ssids, nil
}

func ListSSIDs(ctx context.Context, conn remote.RemoteConn) ([]string, error) {
	if conn == nil {
		return nil, fmt.Errorf("missing connection")
	}
	nm := &network.Manager{
		Timeout: 5 * time.Second,
		Conn:    conn,
	}
	return listSSIDs(ctx, nm)
}
