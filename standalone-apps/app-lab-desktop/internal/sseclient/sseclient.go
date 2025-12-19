package sseclient

import (
	"bufio"
	"context"
	"fmt"
	"iter"
	"net/http"
	"strings"
)

func NewSSEClient(ctx context.Context, method, url string) iter.Seq2[Event, error] {
	return func(yield func(Event, error) bool) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			_ = yield(Event{}, err)
			return
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			_ = yield(Event{}, err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			_ = yield(Event{}, fmt.Errorf("got response status code %d", resp.StatusCode))
			return
		}

		reader := bufio.NewReader(resp.Body)

		evt := Event{}
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				_ = yield(Event{}, err)
				return
			}
			switch {
			case strings.HasPrefix(line, "data:"):
				evt.Data = []byte(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
			case strings.HasPrefix(line, "event:"):
				evt.Event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			case strings.HasPrefix(line, "id:"):
				evt.ID = strings.TrimSpace(strings.TrimPrefix(line, "id:"))
			case strings.HasPrefix(line, "\n"):
				if !yield(evt, nil) {
					return
				}
				evt = Event{}
			default:
				_ = yield(Event{}, fmt.Errorf("unknown line: '%s'", line))
				return
			}
		}
	}
}

type Event struct {
	ID    string
	Event string
	Data  []byte // json
}
