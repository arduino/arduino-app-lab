package agent

import (
	"context"
	"testing"

	acp "github.com/coder/acp-go-sdk"
)

func form(message string, props map[string]any) *acp.UnstableCreateElicitationForm {
	f := &acp.UnstableCreateElicitationForm{Message: message}
	f.RequestedSchema.Properties = props
	return f
}

// Claude's numbered fields and _meta detail must keep working now that the parser reads the schema.
func TestClaudeQuestionsStillParse(t *testing.T) {
	got := parseElicitation(form("Pick", map[string]any{
		"question_1": map[string]any{
			"type":        "string",
			"description": "Second",
			"oneOf": []any{
				map[string]any{"const": "b"},
			},
		},
		"question_0": map[string]any{
			"type":        "string",
			"description": "First",
			"oneOf": []any{
				map[string]any{"const": "a", "_meta": map[string]any{
					"_claude/askUserQuestionOption": map[string]any{"description": "the a one"},
				}},
			},
		},
		"question_0_custom": map[string]any{"type": "string"},
	}))

	if len(got) != 2 {
		t.Fatalf("got %d questions, want 2 (the _custom companion is not one of its own)", len(got))
	}
	// Numbered fields are asked in their number's order; a map has none of its own.
	if got[0].req.Title != "First" || got[1].req.Title != "Second" {
		t.Errorf("order = %q, %q; want First, Second", got[0].req.Title, got[1].req.Title)
	}
	if !got[0].req.AllowOther {
		t.Error("question_0 has a _custom companion, so it accepts an answer of the user's own")
	}
	if got[1].req.AllowOther {
		t.Error("question_1 has no companion and must not offer one")
	}
	if got[0].req.Options[0].Description != "the a one" {
		t.Errorf("option detail = %q, want the one from _meta", got[0].req.Options[0].Description)
	}
	if got[0].req.Kind == ChoiceKindText {
		t.Error("a question with options is not a text question")
	}
}

// Another engine writes the same question as a plain enum; reading only Claude's spelling asked nobody.
func TestAPlainEnumIsAQuestionToo(t *testing.T) {
	got := parseElicitation(form("Which board?", map[string]any{
		"board": map[string]any{"type": "string", "enum": []any{"uno", "ventunoq"}},
		"tags":  map[string]any{"type": "array", "items": map[string]any{"enum": []any{"x", "y"}}},
	}))

	if len(got) != 2 {
		t.Fatalf("got %d questions, want 2", len(got))
	}
	byKey := map[string]parsedQuestion{got[0].fieldKey: got[0], got[1].fieldKey: got[1]}
	board := byKey["board"]
	if len(board.req.Options) != 2 || board.req.Options[0].Label != "uno" {
		t.Errorf("board options = %+v, want uno and ventunoq", board.req.Options)
	}
	if board.multiple {
		t.Error("a string field takes one answer")
	}
	if !byKey["tags"].multiple {
		t.Error("an array field takes several")
	}
}

// The engine asked for prose, so the kind says text and the UI shows a field, not a one-row list.
func TestAStringWithNoOptionsAsksForText(t *testing.T) {
	got := parseElicitation(form("Describe the fault", map[string]any{
		"detail": map[string]any{"type": "string", "description": "What happened?"},
	}))

	if len(got) != 1 {
		t.Fatalf("got %d questions, want 1", len(got))
	}
	if got[0].req.Kind != ChoiceKindText {
		t.Errorf("kind = %q, want %q", got[0].req.Kind, ChoiceKindText)
	}
	if !got[0].req.AllowOther {
		t.Error("a text question must accept the text, or there is nothing to answer with")
	}
	if got[0].req.Title != "What happened?" {
		t.Errorf("title = %q, want the field's own description", got[0].req.Title)
	}
}

// Neither options nor a string: nothing we can put on screen without inventing a control for it.
func TestAnUnrenderableFieldIsSkipped(t *testing.T) {
	got := parseElicitation(form("How many?", map[string]any{
		"count": map[string]any{"type": "integer"},
	}))
	if len(got) != 0 {
		t.Errorf("got %d questions from a field we cannot render", len(got))
	}
}

// anyOf is the same question as oneOf; reading only one spelling asks nobody, silently.
func TestOptionsAreReadFromEverySpelling(t *testing.T) {
	got := parseElicitation(form("Pick", map[string]any{
		"one":   map[string]any{"type": "string", "oneOf": []any{map[string]any{"const": "a"}}},
		"any":   map[string]any{"type": "string", "anyOf": []any{map[string]any{"const": "b"}}},
		"plain": map[string]any{"type": "string", "enum": []any{"c"}},
		"many": map[string]any{"type": "array", "items": map[string]any{
			"anyOf": []any{map[string]any{"const": "d"}, map[string]any{"title": "e"}},
		}},
	}))

	if len(got) != 4 {
		t.Fatalf("got %d questions, want 4", len(got))
	}
	byKey := map[string]parsedQuestion{}
	for _, q := range got {
		byKey[q.fieldKey] = q
	}
	for key, want := range map[string]string{"one": "a", "any": "b", "plain": "c"} {
		q := byKey[key]
		if len(q.req.Options) != 1 || q.req.Options[0].Label != want {
			t.Errorf("%s options = %+v, want %q", key, q.req.Options, want)
		}
		if q.req.Kind == ChoiceKindText {
			t.Errorf("%s: a field with options is not a text question", key)
		}
	}
	// An array's options live under items, and a title stands in where there is no const.
	many := byKey["many"]
	if !many.multiple || len(many.req.Options) != 2 || many.req.Options[1].Label != "e" {
		t.Errorf("array options = %+v (multiple=%v), want d and e", many.req.Options, many.multiple)
	}
}

// One form can hold both, and the text question must not be dropped for having no options.
func TestAFormMixesTextWithChoices(t *testing.T) {
	got := parseElicitation(form("Report the fault", map[string]any{
		"question_0": map[string]any{
			"type": "string", "description": "Which board?",
			"oneOf": []any{map[string]any{"const": "uno"}},
		},
		"question_1": map[string]any{"type": "string", "description": "What happened?"},
	}))

	if len(got) != 2 {
		t.Fatalf("got %d questions, want both", len(got))
	}
	if got[0].req.Kind == ChoiceKindText || got[0].req.Title != "Which board?" {
		t.Errorf("first = %+v, want the choice question", got[0].req)
	}
	if got[1].req.Kind != ChoiceKindText || got[1].req.Title != "What happened?" {
		t.Errorf("second = %+v, want the text question", got[1].req)
	}
}

// A schema the engine left out, or one with no properties: nothing to ask, and nothing to panic on.
func TestAnAbsentSchemaAsksNothing(t *testing.T) {
	if got := parseElicitation(form("Anything?", nil)); len(got) != 0 {
		t.Errorf("got %d questions from a schema with no properties", len(got))
	}
	if got := parseElicitation(form("Anything?", map[string]any{})); len(got) != 0 {
		t.Errorf("got %d questions from an empty schema", len(got))
	}
	// A property that is not an object at all (a bare "true", as JSON Schema allows) is skipped.
	if got := parseElicitation(form("Anything?", map[string]any{"open": true})); len(got) != 0 {
		t.Errorf("got %d questions from a property with no shape", len(got))
	}
}

// An empty list is not a question: a card with no options and no text field cannot be answered.
func TestAnEmptyEnumNeverRendersAnUnanswerableCard(t *testing.T) {
	got := parseElicitation(form("Which?", map[string]any{
		"board": map[string]any{"type": "string", "enum": []any{}},
		"tags":  map[string]any{"type": "array", "items": map[string]any{"enum": []any{}}},
	}))
	for _, q := range got {
		if len(q.req.Options) == 0 && q.req.Kind != ChoiceKindText {
			t.Errorf("%s: no options and not a text question, so there is nothing to answer with", q.fieldKey)
		}
		if q.req.Kind == ChoiceKindText && !q.req.AllowOther {
			t.Errorf("%s: a text question that accepts no text", q.fieldKey)
		}
	}
	// The array has no string to fall back to, so it must be dropped rather than shown empty.
	for _, q := range got {
		if q.fieldKey == "tags" {
			t.Error("an array field with no options was rendered anyway")
		}
	}
}

// The detail is what the option means; without it the card shows bare labels the model chose.
func TestOptionDetailFallsBackToTheTitle(t *testing.T) {
	got := parseElicitation(form("Pick", map[string]any{
		"question_0": map[string]any{"type": "string", "oneOf": []any{
			map[string]any{"const": "Rewrite", "title": "Rewrite — start the sketch again"},
			map[string]any{"const": "Patch"},
		}},
	}))
	if len(got) != 1 {
		t.Fatalf("got %d questions, want 1", len(got))
	}
	opts := got[0].req.Options
	if len(opts) != 2 {
		t.Fatalf("options = %+v, want 2", opts)
	}
	if opts[0].Description != "start the sketch again" {
		t.Errorf("detail = %q, want the part after the dash", opts[0].Description)
	}
	// The label stays the value the reply has to carry, not the decorated title.
	if opts[0].ID != "Rewrite" || opts[0].Label != "Rewrite" {
		t.Errorf("option = %+v, want the const as both id and label", opts[0])
	}
	if opts[1].Description != "" {
		t.Errorf("an option with no detail got %q", opts[1].Description)
	}
}

// Unnumbered keys have no order of their own, so they are sorted; a map's iteration is not.
func TestUnnumberedFieldsAreAskedInAStableOrder(t *testing.T) {
	props := map[string]any{
		"zulu":       map[string]any{"type": "string", "enum": []any{"z"}},
		"alpha":      map[string]any{"type": "string", "enum": []any{"a"}},
		"question_0": map[string]any{"type": "string", "enum": []any{"n"}},
	}
	for i := 0; i < 5; i++ {
		got := parseElicitation(form("Pick", props))
		keys := []string{got[0].fieldKey, got[1].fieldKey, got[2].fieldKey}
		if keys[0] != "question_0" || keys[1] != "alpha" || keys[2] != "zulu" {
			t.Fatalf("order = %v, want the numbered field first then the rest sorted", keys)
		}
	}
}

// The answer goes back under the schema's own keys: a wrong shape loses it with no error anywhere.
type answeringHandler struct{ answers []ChoiceSubmission }

func (h *answeringHandler) HandleUpdate(SessionID, Update) {}
func (h *answeringHandler) HandlePermission(context.Context, PermissionRequest) PermissionOutcome {
	return PermissionOutcome{Cancelled: true}
}
func (h *answeringHandler) HandleElicitation(context.Context, SessionID, []ChoiceRequest) []ChoiceSubmission {
	return h.answers
}

func TestTheReplyCarriesEachAnswerUnderItsFieldKey(t *testing.T) {
	f := form("Report", map[string]any{
		"question_0": map[string]any{"type": "string", "description": "Which board?", "oneOf": []any{
			map[string]any{"const": "uno"}, map[string]any{"const": "ventunoq"},
		}},
		"question_0_custom": map[string]any{"type": "string"},
		"question_1": map[string]any{"type": "array", "description": "Which parts?", "items": map[string]any{
			"enum": []any{"sketch", "python"},
		}},
		"question_2": map[string]any{"type": "string", "description": "What happened?"},
	})
	h := &answeringHandler{answers: []ChoiceSubmission{
		{SelectedIDs: []string{"uno"}, Other: "a board of my own"},
		{SelectedIDs: []string{"sketch", "python"}},
		{Other: "it stopped blinking"},
	}}
	c := &sdkConn{handler: h, dialect: openCodeDialect}

	resp, err := c.UnstableCreateElicitation(context.Background(), acp.UnstableCreateElicitationRequest{Form: f})
	if err != nil {
		t.Fatalf("UnstableCreateElicitation: %v", err)
	}
	if resp.Accept == nil {
		t.Fatalf("response = %+v, want the answers accepted", resp)
	}
	content := resp.Accept.Content
	if content["question_0"] != "uno" {
		t.Errorf("question_0 = %v, want the single pick as a bare string", content["question_0"])
	}
	if content["question_0_custom"] != "a board of my own" {
		t.Errorf("the free-text answer went to %v, want the _custom companion", content["question_0_custom"])
	}
	many, ok := content["question_1"].([]string)
	if !ok || len(many) != 2 {
		t.Errorf("question_1 = %#v, want both picks as a list", content["question_1"])
	}
	// A text question IS its field, so its answer goes there rather than to a companion.
	if content["question_2"] != "it stopped blinking" {
		t.Errorf("question_2 = %v, want the typed answer", content["question_2"])
	}
	if _, ok := content["question_2_custom"]; ok {
		t.Error("a text answer must not also be sent as a custom answer")
	}
}

// Skipping every question is an answer of its own: accepting an empty form would submit nothing as something.
func TestSkippingEveryQuestionDeclines(t *testing.T) {
	f := form("Which board?", map[string]any{
		"board": map[string]any{"type": "string", "enum": []any{"uno"}},
	})
	c := &sdkConn{handler: &answeringHandler{answers: []ChoiceSubmission{{Cancelled: true}}}}
	resp, err := c.UnstableCreateElicitation(context.Background(), acp.UnstableCreateElicitationRequest{Form: f})
	if err != nil {
		t.Fatalf("UnstableCreateElicitation: %v", err)
	}
	if resp.Accept != nil {
		t.Errorf("response = %+v, want a decline", resp)
	}
	// Same for a form with nothing renderable in it, and for url-mode (no form at all).
	unrenderable := form("How many?", map[string]any{"count": map[string]any{"type": "integer"}})
	if resp, _ := c.UnstableCreateElicitation(context.Background(), acp.UnstableCreateElicitationRequest{Form: unrenderable}); resp.Accept != nil {
		t.Error("a form with no renderable question was accepted")
	}
	if resp, _ := c.UnstableCreateElicitation(context.Background(), acp.UnstableCreateElicitationRequest{}); resp.Accept != nil {
		t.Error("a url-mode elicitation was accepted as a form")
	}
}
