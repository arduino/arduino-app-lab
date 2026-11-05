package agentauth

import (
	"bufio"
	"context"
	"strings"
	"testing"

	"app-lab-desktop/internal/airuntime"
)

// A deleted app's chats reach every engine's delete, and one with no delete command must refuse before it runs anything.
func TestDeleteSessionCLIRefusesAnAgentWithoutTheCommand(t *testing.T) {
	err := DeleteSessionCLI(context.Background(), airuntime.AgentClaude, "s1")
	if err == nil || !strings.Contains(err.Error(), "no CLI command") {
		t.Errorf("DeleteSessionCLI(claude) = %v, want a refusal naming the missing command", err)
	}
}

// A spinner redraws with \r only; read as one endless line it would stop the scanner, and the pipe with it.
func TestCLIOutputLinesEndAtACarriageReturnToo(t *testing.T) {
	in := "Go to: https://github.com/login/device\r\nEnter code: 1A2B-C3D4\n\u25d2 Waiting\r\u25d0 Waiting\rdone"
	sc := bufio.NewScanner(strings.NewReader(in))
	sc.Split(scanLinesOrCR)
	var got []string
	for sc.Scan() {
		got = append(got, sc.Text())
	}
	want := []string{"Go to: https://github.com/login/device", "Enter code: 1A2B-C3D4", "\u25d2 Waiting", "\u25d0 Waiting", "done"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Errorf("lines = %q, want %q", got, want)
	}
	if err := sc.Err(); err != nil {
		t.Errorf("scan: %v", err)
	}
}
