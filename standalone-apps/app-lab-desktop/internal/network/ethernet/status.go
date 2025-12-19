package ethernet

import (
	"app-lab-desktop/internal/network"
	"context"
	"fmt"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

type EthStatus string

var (
	ConnectedStatus    EthStatus = "connected"
	ConnectingStatus   EthStatus = "connecting"
	DisconnectedStatus EthStatus = "disconnected"
)

func GetEthStatus(ctx context.Context, conn remote.RemoteConn) (EthStatus, error) {
	if conn == nil {
		return DisconnectedStatus, fmt.Errorf("missing connection")
	}

	nm := &network.Manager{
		Timeout: 5 * time.Second,
		Conn:    conn,
	}

	switch status, err := nm.GetStatusByType(ctx, "ethernet"); {
	case err != nil:
		return DisconnectedStatus, fmt.Errorf("failed to get Ethernet status: %w", err)
	case status == network.ConnectedStatus:
		return ConnectedStatus, nil
	case status == network.ConnectingStatus:
		return ConnectingStatus, nil
	default:
		return DisconnectedStatus, nil
	}
}
