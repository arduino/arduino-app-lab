package flasher

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"runtime"
	"strings"
	"sync"

	rpc "github.com/arduino/arduino-flasher-cli/rpc/cc/arduino/flasher/v1"
	"github.com/arduino/go-paths-helper"
	runas "github.com/arduino/go-windows-runas"
	"go.bug.st/f"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"app-lab-desktop/internal/board"
)

// The arduino-flasher-cli daemon lives in background
// as long as the board is running. It is a
// single daemon instance per application
// Targeting different boards is not yet supported
// in the current arduino-flasher-cli release
type Flasher struct {
	Process *paths.Process
	Port    string
	client  rpc.FlasherClient
	conn    *grpc.ClientConn
}

var FlashDaemonService = sync.OnceValues(func() (*Flasher, error) {
	return runFlasherCliDaemon()
})

var flasherInstance *Flasher = nil

func CancelFlash() {
	// Kill the daemon process to stop any ongoing flash operation
	if flasherInstance != nil {
		flasherInstance.DaemonShutDown()
		flasherInstance = nil
		// Reset the singleton so it can be recreated
		FlashDaemonService = sync.OnceValues(func() (*Flasher, error) {
			return runFlasherCliDaemon()
		})
	}
}

func runFlasherCliDaemon() (*Flasher, error) {
	binPath := board.GetFlasherCli()

	// start daemon
	cmd, err := paths.NewProcess(nil, binPath, "daemon", "--format", "json", "--port", "0") // use a random port
	if err != nil {
		return nil, err
	}
	output, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	port, err := getPort(output)
	if err != nil {
		return nil, err
	}
	slog.Info("arduino-flasher-cli daemon listening", "port", port)

	// create connection
	endpoint := net.JoinHostPort("localhost", port)
	conn, err := grpc.NewClient(endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("Error getting grpc connection: %s", endpoint)
	}

	// create client
	client := rpc.NewFlasherClient(conn)

	return &Flasher{
		Process: cmd,
		Port:    port,
		conn:    conn,
		client:  client,
	}, nil
}

func getPort(output io.Reader) (string, error) {
	var resp struct {
		Host  string `json:"host"`
		Port  string `json:"port"`
		Error string `json:"error"`
	}

	if err := json.NewDecoder(output).Decode(&resp); err != nil {
		return "", fmt.Errorf("failed to decode daemon JSON: %w", err)
	}

	if resp.Error != "" {
		return "", fmt.Errorf("daemon reported error: %s", resp.Error)
	}

	if resp.Port == "" {
		return "", fmt.Errorf("daemon response missing port")
	}

	return resp.Port, nil
}

// Free daemon allocated resources.
func (f *Flasher) DaemonShutDown() {
	slog.Debug("Killing monitor process")
	if err := f.Process.Kill(); err != nil {
		slog.Warn("Failed to kill process", slog.Any("error", err))
	}
}

func IsUserPartitionPreservationSupported(currentImageVersion string, targetImageVersion string) bool {
	const R0ImageVersionID = "20250807-136"
	return currentImageVersion != R0ImageVersionID && targetImageVersion != R0ImageVersionID
}

func ListAvailableOSImages(ctx context.Context) ([]OSImageRelease, error) {
	flasher, err := FlashDaemonService()
	if err != nil {
		return nil, fmt.Errorf("daemon initialization failed: %w", err)
	}
	listResponse, err := flasher.client.List(ctx, &rpc.ListRequest{})
	if err != nil {
		return nil, fmt.Errorf("Failed to get List response: %w", err)
	}
	releases := listResponse.Releases

	return f.Map(releases, func(r *rpc.Release) OSImageRelease {
		buildStrings := strings.Split(r.BuildId, "-")
		return OSImageRelease{
			VersionLabel: r.BuildId,
			ID:           buildStrings[1],
			Latest:       r.Latest,
		}
	}), nil
}

func getCacheDir() (string, error) {
	userCacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", fmt.Errorf("could not get user's cache directory: %w", err)
	}

	cacheDir := paths.New(userCacheDir, "arduino-app-lab", "flasher_cache")
	if err := cacheDir.MkdirAll(); err != nil {
		return "", fmt.Errorf("could not create cache directory: %w", err)
	}

	return cacheDir.String(), nil
}

func GetAvailableFreeSpace(ctx context.Context) (uint64, error) {
	flasher, err := FlashDaemonService()
	if err != nil {
		return 0, fmt.Errorf("daemon initialization failed: %w", err)
	}

	cacheDir, err := getCacheDir()
	if err != nil {
		return 0, fmt.Errorf("could not get cache directory: %w", err)
	}

	req := &rpc.GetAvailableFreeSpaceRequest{
		Path: cacheDir,
	}
	availableMemory, err := flasher.client.GetAvailableFreeSpace(ctx, req)
	if err != nil {
		return 0, fmt.Errorf("failed to check disk space: %w", err)
	}
	return availableMemory.FreeSpace, nil
}

type OSImageRelease struct {
	VersionLabel string
	ID           string
	Latest       bool
}

type FlashStep string

const (
	FlashStepDownloading FlashStep = "downloading"
	FlashStepExtracting  FlashStep = "extracting"
	FlashStepFlashing    FlashStep = "flashing"
)

type FlashEvent struct {
	Step FlashStep `json:"step"`
	Log  *string   `json:"log,omitempty"`

	Progress int64 `json:"progress,omitempty"`
	Total    int64 `json:"total,omitempty"`
}

func Flash(serial string, imageVersion OSImageRelease, preserveUserPartition bool, eventCB func(event FlashEvent),
) error {
	if runtime.GOOS == "windows" {
		err := installWindowsDrivers()
		if err != nil {
			return err
		}
	}
	flasher, err := FlashDaemonService()
	if err != nil {
		return fmt.Errorf("daemon initialization failed: %w", err)
	}
	flasherInstance = flasher

	cacheDir, err := getCacheDir()
	if err != nil {
		return fmt.Errorf("could not get cache directory: %w", err)
	}

	req := &rpc.FlashRequest{
		Serial:       serial,
		Version:      imageVersion.VersionLabel,
		TempPath:     cacheDir,
		PreserveUser: preserveUserPartition,
	}
	stream, err := flasher.client.Flash(context.Background(), req)
	if err != nil {
		return fmt.Errorf("flash operation failed: %w", err)
	}

	for {
		resp, err := stream.Recv()
		if err == io.EOF { // Flash done
			return nil
		}
		if err != nil {
			return fmt.Errorf("flashing error: %w", err)
		}

		switch msg := resp.GetMessage().(type) {
		// handle download
		case *rpc.FlashResponse_DownloadProgress:
			dp := msg.DownloadProgress
			switch dMsg := dp.GetMessage().(type) {
			case *rpc.DownloadProgress_Start:
				eventCB(FlashEvent{
					Step: FlashStepDownloading,
					Log:  f.Ptr(fmt.Sprintf("starting download: %s", dMsg.Start.Label)),
				})
			case *rpc.DownloadProgress_Update:
				eventCB(FlashEvent{
					Step:     FlashStepDownloading,
					Progress: dMsg.Update.Downloaded,
					Total:    dMsg.Update.TotalSize,
					Log:      f.Ptr(fmt.Sprintf("downloading")),
				})
			case *rpc.DownloadProgress_End:
				if !dMsg.End.Success {
					return fmt.Errorf("download failed: %s", dMsg.End.Message)
				}
				eventCB(FlashEvent{
					Step: FlashStepDownloading,
					Log:  f.Ptr(fmt.Sprintf("download done: %d%%", 1)),
				})
			}

		// handle extraction
		case *rpc.FlashResponse_ExtractionProgress:
			if msg.ExtractionProgress.Completed {
				eventCB(FlashEvent{
					Step: FlashStepExtracting,
					Log:  f.Ptr("completed"),
				})
			} else {
				eventCB(FlashEvent{
					Step: FlashStepExtracting,
					Log:  f.Ptr(msg.ExtractionProgress.GetMessage()),
				})
			}
		// handle flash
		case *rpc.FlashResponse_FlashProgress:
			if msg.FlashProgress.Completed {
				eventCB(FlashEvent{
					Step: FlashStepFlashing,
					Log:  f.Ptr("completed"),
				})
			} else {
				eventCB(FlashEvent{
					Step:     FlashStepFlashing,
					Progress: msg.FlashProgress.Progress,
					Total:    msg.FlashProgress.Total,
					Log:      f.Ptr(msg.FlashProgress.GetMessage()),
				})
			}
		default:
			slog.Warn("unexpected FlasherResponse", "message", resp.GetMessage())
		}
	}
}

func installWindowsDrivers() error {
	binPath := board.GetFlasherCli()
	pwd, _ := os.Getwd()
	if _, err := runas.RunElevated(binPath, pwd, []string{"install-drivers"}, true, true); err != nil {
		return err
	}
	return nil
}
