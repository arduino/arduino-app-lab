package boardmcp

import (
	"encoding/json"
	"strings"
	"testing"
)

// app_bricks_list is auto-approved (read-only) and Brick Configuration holds the user's secrets:
// no config variable value may ever appear in the result.
func TestShapeAppBricksNeverLeaksVariableValues(t *testing.T) {
	const secret = "sk-live-SUPER-SECRET-TOKEN"
	raw := `{"bricks":[{
		"id":"arduino:openai","name":"OpenAI","category":"ai","status":"ok","require_model":false,
		"config_variables":[
			{"name":"OPENAI_API_KEY","value":"` + secret + `"},
			{"name":"MODEL","value":""},
			{"name":"ENDPOINT"}
		]}]}`

	got, err := shapeAppBricks(raw)
	if err != nil {
		t.Fatalf("shapeAppBricks: %v", err)
	}
	if strings.Contains(got, secret) || strings.Contains(got, "sk-live") {
		t.Fatalf("a config variable value reached the model context:\n%s", got)
	}

	var out struct {
		Bricks []appBrickInstance `json:"bricks"`
	}
	if err := json.Unmarshal([]byte(got), &out); err != nil {
		t.Fatalf("result is not valid JSON: %v", err)
	}
	if len(out.Bricks) != 1 {
		t.Fatalf("expected one brick, got %d", len(out.Bricks))
	}
	want := []appBrickVariable{
		{Name: "ENDPOINT", IsSet: false},
		{Name: "MODEL", IsSet: false},
		{Name: "OPENAI_API_KEY", IsSet: true},
	}
	if len(out.Bricks[0].Variables) != len(want) {
		t.Fatalf("variables = %+v, want %+v", out.Bricks[0].Variables, want)
	}
	for i, v := range out.Bricks[0].Variables {
		if v != want[i] {
			t.Errorf("variable %d = %+v, want %+v", i, v, want[i])
		}
	}
}

// The description must not promise values, or the model reports their absence as a fault.
func TestAppBricksListDescriptionDoesNotPromiseValues(t *testing.T) {
	desc := appBricksListDescription
	if strings.Contains(desc, "config variable values") {
		t.Fatalf("the description still promises values: %q", desc)
	}
	if !strings.Contains(desc, "never returned") {
		t.Fatalf("the description must say values are withheld: %q", desc)
	}
}
