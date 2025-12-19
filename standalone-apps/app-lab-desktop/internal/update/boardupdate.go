package update

import (
	"app-lab-desktop/internal/sseclient"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func CheckBoardUpdateV1Request(onlyArduino bool, origin string) (string, error) {
	u, err := url.Parse(origin)
	if err != nil {
		return "", fmt.Errorf("invalid origin URL")
	}
	u = u.JoinPath("/v1/system/update/check")

	queryValues := u.Query()
	if onlyArduino {
		queryValues.Set("only-arduino", "true")
	}
	u.RawQuery = queryValues.Encode()

	r, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return "", nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode == http.StatusOK {
		return string(body), nil
	}

	return "", fmt.Errorf("unexpected response status code: %d", resp.StatusCode)
}

func ApplyBoardUpdateV1Request(onlyArduino bool, origin string) (*bool, error) {
	u, err := url.Parse(origin)
	if err != nil {
		return nil, fmt.Errorf("invalid origin URL")
	}
	u = u.JoinPath("/v1/system/update/apply")

	queryValues := u.Query()
	if onlyArduino {
		queryValues.Set("only-arduino", "true")
	}
	u.RawQuery = queryValues.Encode()

	r, err := http.NewRequest(http.MethodPut, u.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		return nil, err
	}
	resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusAccepted:
		result := true
		return &result, nil
	case http.StatusNoContent:
		return nil, nil
	default:
		return nil, fmt.Errorf("unexpected response status code: %d", resp.StatusCode)
	}
}

func GetBoardUpdateLogsStreamV1Request(ctx context.Context, origin string) error {
	u, err := url.Parse(origin)
	if err != nil {
		return fmt.Errorf("invalid origin URL")
	}
	u = u.JoinPath("/v1/system/update/events")

	ctx, cancel := context.WithCancel(ctx)
	eventCancel := runtime.EventsOnce(ctx, "board-update-log-stop", func(_ ...any) {
		cancel()
	})

	runtime.LogInfo(ctx, "Starting board update log stream")

	stream := sseclient.NewSSEClient(ctx, http.MethodGet, u.String())
	go func() {
		defer cancel()
		defer eventCancel()

		for event, err := range stream {
			if err != nil {
				runtime.EventsEmit(ctx, "board-update-log-onerror", err.Error())
				return
			}

			runtime.LogInfof(ctx, "Board update log event %s", event)
			runtime.EventsEmit(ctx, "board-update-log-onmessage", event)
		}
	}()

	return nil
}
