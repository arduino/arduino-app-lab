package arduinoapps

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ImportAppResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func uploadAppFile(ctx context.Context, orchestratorURL string, filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer writer.Close()

		part, err := writer.CreateFormFile("file", filepath.Base(filePath))
		if err != nil {
			return
		}

		_, err = io.Copy(part, file)
		if err != nil {
			return
		}
	}()

	url := fmt.Sprintf("%s/v1/apps/import", orchestratorURL)

	req, err := http.NewRequest("POST", url, pr)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusCreated:
		var importResp ImportAppResponse
		err = json.Unmarshal(respBody, &importResp)
		if err != nil {
			return "", fmt.Errorf("failed to parse response: %w", err)
		}

		runtime.EventsEmit(ctx, "import:success", map[string]string{
			"appID":   importResp.ID,
			"appName": importResp.Name,
		})

		// Return full JSON response (not just ID)
		return string(respBody), nil

	case http.StatusBadRequest:
		var errorResp map[string]string
		if err := json.Unmarshal(respBody, &errorResp); err == nil {
			if details, ok := errorResp["details"]; ok {
				return "", fmt.Errorf("%s", details)
			}
		}
		return "", fmt.Errorf("validation error: %s", string(respBody))

	case http.StatusConflict:
		var errorResp map[string]string
		if err := json.Unmarshal(respBody, &errorResp); err == nil {
			if details, ok := errorResp["details"]; ok {
				return "", fmt.Errorf("%s", details)
			}
		}
		return "", fmt.Errorf("conflict: %s", string(respBody))

	case http.StatusInsufficientStorage:
		return "", fmt.Errorf("BOARD_STORAGE_FULL")

	case http.StatusInternalServerError:
		var errorResp map[string]string
		if err := json.Unmarshal(respBody, &errorResp); err == nil {
			if details, ok := errorResp["details"]; ok {
				return "", fmt.Errorf("%s", details)
			}
		}
		return "", fmt.Errorf("server error: %s", string(respBody))

	default:
		return "", fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(respBody))
	}
}

func SelectAppDialog(ctx context.Context, orchestratorURL string) (string, error) {
	filePath, err := runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{
		Title: "Select App to Import",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "ZIP Archive (*.zip)",
				Pattern:     "*.zip",
			},
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}

	// User cancelled - return empty string, no error
	if filePath == "" {
		return "", nil
	}

	return filePath, err
}

func SelectAiModelDialog(ctx context.Context, orchestratorURL string) (string, error) {
	filePath, err := runtime.OpenFileDialog(ctx, runtime.OpenDialogOptions{
		Title: "Select Model to Import",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "GGUF Archive (*.gguf)",
				Pattern:     "*.gguf",
			},
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}

	// User cancelled - return empty string, no error
	if filePath == "" {
		return "", nil
	}

	return filePath, err
}

func ImportAppFromPath(ctx context.Context, orchestratorURL string, filePath string) (string, error) {
	appID, err := uploadAppFile(ctx, orchestratorURL, filePath)

	if filepath.Dir(filePath) == os.TempDir() {
		os.Remove(filePath)
	}

	return appID, err
}
