package appid

import (
	"encoding/base64"
	"math/rand"
	"strings"
	"testing"
)

// Every spelling a model was seen to use names the app the board knows by the unpadded base64url id.
func TestCanonical(t *testing.T) {
	blink := "dXNlcjpibGluaw" // user:blink
	// examples:core-and-foundational/01-led-blink/03-blinking-an-led-from-python, as the board lists it
	example := "ZXhhbXBsZXM6Y29yZS1hbmQtZm91bmRhdGlvbmFsLzAxLWxlZC1ibGluay8wMy1ibGlua2luZy1hbi1sZWQtZnJvbS1weXRob24"
	for name, tc := range map[string]struct{ in, want string }{
		"the board's own id":           {blink, blink},
		"with spaces around":           {"  " + blink + "\n", blink},
		"padded":                       {blink + "==", blink},
		"a space before the padding":   {blink + " =", blink},
		"spaces and padding mixed":     {blink + " = =\n", blink},
		"decoded":                      {"user:blink", blink},
		"a decoded example":            {"examples:core-and-foundational/01-led-blink/03-blinking-an-led-from-python", example},
		"a decoded release":            {"release:blink", base64.RawURLEncoding.EncodeToString([]byte("release:blink"))},
		"the standard alphabet, plus":  {"dXNlcjp+", "dXNlcjp-"}, // user:~
		"the standard alphabet, slash": {"dXNlcjo/", "dXNlcjo_"}, // user:?
		"an app name":                  {"qa-imp-l4-095837-d", "qa-imp-l4-095837-d"},
		"padding alone":                {"==", ""},
		"a decoded path stays a path":  {"/home/arduino/ArduinoApps/blink", "/home/arduino/ArduinoApps/blink"},
		"empty":                        {"", ""},
	} {
		if got := Canonical(tc.in); got != tc.want {
			t.Errorf("%s: Canonical(%q) = %q, want %q", name, tc.in, got, tc.want)
		}
	}
}

// Only the orchestrator's spelling is valid: a grant scoped to anything else can never answer a call the board takes.
func TestValid(t *testing.T) {
	path := base64.RawURLEncoding.EncodeToString([]byte("/opt/apps/blink"))
	for id, want := range map[string]bool{
		"dXNlcjpibGluaw":     true,
		path:                 true,
		"dXNlcjpibGluaw==":   false,
		"user:blink":         false,
		"qa-imp-l4-095837-d": false,
		"":                   false,
	} {
		if got := Valid(id); got != want {
			t.Errorf("Valid(%q) = %v, want %v", id, got, want)
		}
	}
}

// A second pass changes nothing, so every layer that reads the id again (the checkout, the delete, the permission layer) names the same app.
func TestCanonicalIsIdempotent(t *testing.T) {
	r := rand.New(rand.NewSource(1))
	const alphabet = "abcXYZ019+/-_=:. \nuser:examples:release:/"
	for i := 0; i < 200000; i++ {
		var b strings.Builder
		for j, n := 0, r.Intn(24); j < n; j++ {
			b.WriteByte(alphabet[r.Intn(len(alphabet))])
		}
		once := Canonical(b.String())
		if twice := Canonical(once); twice != once {
			t.Fatalf("Canonical(%q) = %q, and Canonical of that = %q", b.String(), once, twice)
		}
	}
}
