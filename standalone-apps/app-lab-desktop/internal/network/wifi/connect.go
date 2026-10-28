package wifi

import (
	"app-lab-desktop/internal/network"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"time"

	"github.com/arduino/arduino-app-cli/pkg/board/remote"
)

// ErrCodeIncorrectPassword is the stable error code returned to the frontend
// when the Wi-Fi password is incorrect. It is part of the API contract:
// the frontend matches this exact code to display the proper error message.
const ErrCodeIncorrectPassword = "ERR_WIFI_INCORRECT_PASSWORD"

// ErrIncorrectPassword is returned when the Wi-Fi password is incorrect
var ErrIncorrectPassword = errors.New(ErrCodeIncorrectPassword)

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

	out, err := nm.Run(ctx, args...)
	if err != nil {
		// If we provided a password and connection failed, it's likely incorrect
		// Other errors (network not found, etc.) are caught earlier in the process
		if password != "" {
			return fmt.Errorf("%w: %w", ErrIncorrectPassword, err)
		}
		return fmt.Errorf("failed to connect to Wi-Fi %q: %w", ssid, err)
	}

	// The board is connected: a profile left without the wait still works once booted.
	if err := setWaitDeviceTimeout(ctx, nm.Conn, out); err != nil {
		slog.Warn("could not set the Wi-Fi device wait, network-online.target may be reached before Wi-Fi at boot", "error", err)
	}
	return nil
}

// waitDeviceTimeout bounds how long NetworkManager-wait-online waits at boot for
// the Wi-Fi device to appear. On the UNO Q, wlan0 appears 4-5s after
// NetworkManager starts, because the Wi-Fi firmware runs on the modem DSP; with
// no wait, network-online.target is reached before wlan0 exists. The wait ends
// as soon as the device appears, and stays below the 60s timeout of
// NetworkManager-wait-online so the activation still fits in it.
const waitDeviceTimeout = 30 * time.Second

// profileUUID matches the UUID of the profile in the reply of
// `device wifi connect`, "Device 'wlan0' successfully activated with '<uuid>'.",
// whatever the locale of the board.
var profileUUID = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

// setWaitDeviceTimeout sets the wait on the profile that `device wifi connect`
// activated, which it creates with no wait.
func setWaitDeviceTimeout(ctx context.Context, conn remote.RemoteConn, connectOut string) error {
	// The reply ends with the activation message, after any password prompt.
	uuids := profileUUID.FindAllString(connectOut, -1)
	if len(uuids) == 0 {
		return fmt.Errorf("no profile UUID in the connect reply %q", connectOut)
	}
	uuid := uuids[len(uuids)-1]

	// The connect already succeeded, so a stalled session must not hold it up for long.
	nm := &network.Manager{
		Timeout: 5 * time.Second,
		Conn:    conn,
	}
	timeout := strconv.FormatInt(waitDeviceTimeout.Milliseconds(), 10)
	if _, err := nm.Run(ctx, "connection", "modify", "uuid", uuid, "connection.wait-device-timeout", timeout); err != nil {
		return fmt.Errorf("failed to set the wait on Wi-Fi profile %s: %w", uuid, err)
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
