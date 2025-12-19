package wifi

import (
	"app-lab-desktop/internal/network"
	"context"
	"fmt"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

type WifiStatus string

var (
	ConnectedStatus    WifiStatus = "connected"
	ConnectingStatus   WifiStatus = "connecting"
	DisconnectedStatus WifiStatus = "disconnected"
)

func GetWiFiStatus(ctx context.Context, conn remote.RemoteConn) (WifiStatus, error) {
	if conn == nil {
		return DisconnectedStatus, fmt.Errorf("missing connection")
	}

	nm := &network.Manager{
		Timeout: 5 * time.Second,
		Conn:    conn,
	}

	switch status, err := nm.GetStatusByType(ctx, "wifi"); {
	case err != nil:
		return DisconnectedStatus, fmt.Errorf("failed to get WiFi status: %w", err)
	case status == network.ConnectedStatus:
		return ConnectedStatus, nil
	case status == network.ConnectingStatus:
		return ConnectingStatus, nil
	default:
		return DisconnectedStatus, nil
	}
}
