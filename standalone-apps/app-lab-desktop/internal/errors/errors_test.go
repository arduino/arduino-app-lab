package errors

import (
	"app-lab-desktop/internal/hw"
	"fmt"
	"testing"
)

// The Wails runtime turns a non-string error into "[object Object]", so the
// frontend can only read the code if it arrives as a JSON string.
func TestHwErrorMiddlewareReturnsJSONString(t *testing.T) {
	format := ChainErrorMiddleware([]ErrorMiddleware{HwErrorMiddleware()})

	err := fmt.Errorf("failed to exec enable command: %w", &hw.HwError{Code: hw.ErrCodeIncorrectPassword, Message: "exit status 1"})
	want := `{"code":"ERR_HW_INCORRECT_PASSWORD","message":"exit status 1"}`
	if got := format(err); got != want {
		t.Errorf("format(hw error) = %v, want %v", got, want)
	}

	if got := format(fmt.Errorf("other")); got != "other" {
		t.Errorf("format(other error) = %v, want \"other\"", got)
	}
}

type codedTestError struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Apps    []string `json:"apps"`
}

func (e *codedTestError) Error() string     { return e.Message }
func (e *codedTestError) ErrorCode() string { return e.Code }

// The frontend words a coded error itself, from its code and the fields its message names, even when it arrives wrapped.
func TestCodedErrorMiddlewareSendsTheErrorsOwnJSON(t *testing.T) {
	format := ChainErrorMiddleware([]ErrorMiddleware{CodedErrorMiddleware()})
	err := fmt.Errorf("switch: %w", &codedTestError{Code: "agent_switch_unsaved_edits", Message: "not yet", Apps: []string{"Blink"}})
	want := `{"code":"agent_switch_unsaved_edits","message":"not yet","apps":["Blink"]}`
	if got := format(err); got != want {
		t.Errorf("format(coded error) = %v, want %v", got, want)
	}
}
