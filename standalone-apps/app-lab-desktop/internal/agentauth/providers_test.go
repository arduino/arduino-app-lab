package agentauth

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/zalando/go-keyring"

	"app-lab-desktop/internal/airuntime"
)

// The catalogue says which variable a key becomes; getting it wrong is silent, just no models.
func TestProviderCatalogueIsReadFromTheEngine(t *testing.T) {
	dir := t.TempDir()
	body := `{
	  "anthropic": {"id":"anthropic","name":"Anthropic","env":["ANTHROPIC_API_KEY"],"doc":"https://docs.anthropic.com"},
	  "google":    {"id":"google","name":"Google","env":["GOOGLE_API_KEY","GEMINI_API_KEY"]},
	  "oauthonly": {"id":"oauthonly","name":"OAuth Only","env":[]}
	}`
	path := filepath.Join(dir, openCodeProfile.providerCatalogRel)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := readProviderCatalog(filepath.Join(dir, openCodeProfile.providerCatalogRel))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d providers, want 2 (the one with no variable is not offerable)", len(got))
	}
	// Sorted by name, and the first variable is the canonical one; the rest are aliases.
	if got[0].ID != "anthropic" || got[0].EnvVar != "ANTHROPIC_API_KEY" {
		t.Errorf("first = %+v, want anthropic/ANTHROPIC_API_KEY", got[0])
	}
	if got[1].EnvVar != "GOOGLE_API_KEY" {
		t.Errorf("google env = %q, want the first of the list", got[1].EnvVar)
	}
}

// The menu lists a free model as needing no key: another provider's zero-priced model still runs on, and may bill, the user's key.
func TestOnlyOpenCodeZensZeroPricedModelsAreFree(t *testing.T) {
	path := filepath.Join(t.TempDir(), "models.json")
	body := `{
	  "opencode": {"models": {
	    "big-pickle": {"cost": {"input": 0, "output": 0}},
	    "paid":       {"cost": {"input": 1.25, "output": 10}},
	    "half":       {"cost": {"input": 0, "output": 2}},
	    "unpriced":   {}
	  }},
	  "google": {"models": {"lyria-3-clip-preview": {"cost": {"input": 0, "output": 0}}}}
	}`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	free := freeModelsIn(path)
	if len(free) != 1 || !free["opencode/big-pickle"] {
		t.Errorf("free = %v, want opencode/big-pickle alone", free)
	}
}

// Every fresh install before the engine runs: no providers to offer, not an error to report.
func TestAMissingCatalogueIsNoProvidersNotAnError(t *testing.T) {
	got, err := readProviderCatalog(filepath.Join(t.TempDir(), "absent.json"))
	if err != nil {
		t.Fatalf("missing catalogue: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("got %d providers from nothing", len(got))
	}
}

// An agent with a single credential of its own has no catalogue, and must not be given another's.
func TestASingleKeyAgentHasNoProviderCatalogue(t *testing.T) {
	if claudeProfile.providerCatalogRel != "" {
		t.Error("Claude points at a provider catalogue; its credential is one key, not one per provider")
	}
	list, err := Providers(airuntime.AgentClaude)
	if err != nil {
		t.Fatalf("providers: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("got %d providers for a single-key agent", len(list))
	}
}

// "Connected x days ago" must survive a restart, so the date lives in the index, not in memory.
func TestFirstConfiguredAtIsTheEarliestOne(t *testing.T) {
	early := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	late := early.Add(72 * time.Hour)
	got := earliestAddedAt([]ConfiguredProvider{
		{ID: "openai", AddedAt: late},
		{ID: "anthropic", AddedAt: early},
		{ID: "groq"}, // added before the index recorded dates: no opinion, not "the beginning of time"
	})
	if !got.Equal(early) {
		t.Errorf("got %v, want the earliest (%v)", got, early)
	}
	if !earliestAddedAt(nil).IsZero() {
		t.Error("no providers should mean no date, not the zero date rendered as one")
	}
}

// Points the app-data root at a temp dir: no test may read or write the user's own agent config.
func isolatedAppData(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir)        // darwin, linux
	t.Setenv("USERPROFILE", dir) // windows: os.UserHomeDir
	t.Setenv("LOCALAPPDATA", filepath.Join(dir, "AppData", "Local"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(dir, ".local", "share"))
	return dir
}

// The in-memory keychain, so no test reaches the user's real one.
func mockKeychain(t *testing.T) {
	t.Helper()
	keyring.MockInit()
}

func writeCatalogue(t *testing.T, agent airuntime.AgentID, body string) {
	t.Helper()
	p, err := profileFor(agent)
	if err != nil {
		t.Fatal(err)
	}
	if p.providerCatalogRel == "" {
		t.Fatalf("%s keeps no provider catalogue", agent)
	}
	root, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, p.providerCatalogRel)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}

// A prefix names a key's provider only when it is that provider's alone: OpenAI's "sk-" starts other providers' keys too.
func TestAKeyIsGivenToTheProviderItsPrefixBelongsTo(t *testing.T) {
	isolatedAppData(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "anthropic": {"name":"Anthropic","env":["ANTHROPIC_API_KEY"]},
	  "google":    {"name":"Google","env":["GOOGLE_API_KEY"]}
	}`)
	for key, want := range map[string][2]string{
		"sk-ant-api03-not-a-real-key": {"anthropic", "Anthropic"},
		"AIzaNotARealKey":             {"google", "Google Gemini"},  // the panel's name, not the catalogue's
		"sk-or-v1-not-a-real-key":     {"openrouter", "openrouter"}, // missing from this catalogue: named by its id
		"oc_sk_not-a-real-key":        {"opencode", "opencode"},
		"sk-proj-not-a-real-key":      {"", ""},
		"sk-not-a-real-key":           {"", ""},
		"no-prefix-at-all":            {"", ""},
	} {
		if id, name := KeyOwner(airuntime.AgentOpenCode, key); id != want[0] || name != want[1] {
			t.Errorf("%s: got %q %q, want %q %q", key, id, name, want[0], want[1])
		}
	}
	if id, _ := KeyOwner(airuntime.AgentClaude, "AIzaNotARealKey"); id != "" {
		t.Errorf("Claude offers no providers, yet the key went to %q", id)
	}
}

// Most of the catalogue carries no address, and a provider's first variable is not always a plain key.
func TestTheCanonicalVariableIsTheFirstOneListed(t *testing.T) {
	dir := t.TempDir()
	// Synthetic entries in the real file's shape: several variables, the first one canonical.
	body := `{
	  "multi":   {"name":"Multi Var","env":["FIRST_TOKEN","SECOND_KEY","THIRD_KEY"],"api":"https://api.multi.test/v1"},
	  "noapi":   {"name":"No Address","env":["NOAPI_API_KEY"]},
	  "emptyapi":{"name":"Empty Address","env":["EMPTY_API_KEY"],"api":""},
	  "noname":  {"env":["NONAME_API_KEY"]}
	}`
	if err := os.MkdirAll(filepath.Join(dir, filepath.Dir(openCodeProfile.providerCatalogRel)), 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, openCodeProfile.providerCatalogRel)
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := readProviderCatalog(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	byID := map[string]Provider{}
	for _, p := range got {
		byID[p.ID] = p
	}
	if len(byID) != 4 {
		t.Fatalf("got %d providers, want 4: %+v", len(byID), got)
	}
	if byID["multi"].EnvVar != "FIRST_TOKEN" {
		t.Errorf("multi-variable provider injects %q, want the first of the list", byID["multi"].EnvVar)
	}
	if byID["multi"].API != "https://api.multi.test/v1" {
		t.Errorf("api = %q, want the catalogue's base URL", byID["multi"].API)
	}
	// No address at all: the key is stored unchecked rather than blamed (see VerifyProviderKey).
	if byID["noapi"].API != "" || byID["emptyapi"].API != "" {
		t.Errorf("a provider with no address got one: %+v / %+v", byID["noapi"], byID["emptyapi"])
	}
	// The row has to say something, and the id is the only name there is.
	if byID["noname"].Name != "noname" {
		t.Errorf("unnamed provider shows as %q, want its id", byID["noname"].Name)
	}
}

// The real file holds a couple of hundred entries, and the list is read straight into a picker.
func TestTheWholeCatalogueIsOffered(t *testing.T) {
	dir := t.TempDir()
	var b strings.Builder
	b.WriteString("{")
	const n = 217
	for i := 0; i < n; i++ {
		if i > 0 {
			b.WriteString(",")
		}
		// Names deliberately out of id order, so a sort by name is visible.
		fmt.Fprintf(&b, `"p%03d":{"name":"Provider %03d","env":["P%03d_API_KEY"]}`, i, n-i, i)
	}
	b.WriteString("}")
	path := filepath.Join(dir, "models.json")
	if err := os.WriteFile(path, []byte(b.String()), 0o600); err != nil {
		t.Fatal(err)
	}

	got, err := readProviderCatalog(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if len(got) != n {
		t.Fatalf("got %d providers, want all %d", len(got), n)
	}
	for i := 1; i < len(got); i++ {
		if strings.ToLower(got[i-1].Name) > strings.ToLower(got[i].Name) {
			t.Fatalf("out of order at %d: %q then %q", i, got[i-1].Name, got[i].Name)
		}
	}
}

// A half-written catalogue must be told apart from an empty one: the first is a fault, the second is normal.
func TestAnUnparseableCatalogueIsReportedAsSuch(t *testing.T) {
	cases := map[string]string{
		"an empty file":       "",
		"a truncated write":   `{"anthropic": {"name":"Anthropic","env":["ANTH`,
		"not JSON at all":     "opencode: command not found\n",
		"a list, not the map": `[{"id":"anthropic"}]`,
	}
	for name, body := range cases {
		path := filepath.Join(t.TempDir(), "models.json")
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
		got, err := readProviderCatalog(path)
		if err == nil {
			t.Errorf("%s: read as %d providers with no error", name, len(got))
			continue
		}
		if !strings.Contains(err.Error(), "provider catalogue") {
			t.Errorf("%s: error %q does not say which file is wrong", name, err)
		}
	}
	// An empty JSON object is a real answer: the engine fetched the list and it held nothing.
	path := filepath.Join(t.TempDir(), "models.json")
	if err := os.WriteFile(path, []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got, err := readProviderCatalog(path); err != nil || len(got) != 0 {
		t.Errorf("an empty catalogue = %v, %v; want no providers and no error", got, err)
	}
}

// The index is on disk in the clear, so it may carry ids and dates and nothing else.
func TestTheProviderIndexNeverHoldsTheKey(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)

	const key = "sk-test-not-a-real-key-0123456789"
	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", key); err != nil {
		t.Fatalf("store: %v", err)
	}
	path, err := providerIndexPath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read index: %v", err)
	}
	if strings.Contains(string(data), key) {
		t.Error("the index file contains the key itself")
	}
	for _, fragment := range []string{"sk-test", "0123456789"} {
		if strings.Contains(string(data), fragment) {
			t.Errorf("the index file contains %q of the key", fragment)
		}
	}
	// What it must hold: the id, so the variable can be resolved, and the date the row shows.
	configured, err := ConfiguredProviders(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatalf("configured: %v", err)
	}
	if len(configured) != 1 || configured[0].ID != "openai" || configured[0].AddedAt.IsZero() {
		t.Errorf("index = %+v, want one dated entry for openai", configured)
	}
	// And the key itself comes back only from the keychain.
	if got, err := ReadProviderKey(airuntime.AgentOpenCode, "openai"); err != nil || got != key {
		t.Errorf("ReadProviderKey = %q, %v; want the stored key", got, err)
	}
}

// One entry per agent and provider: two agents configuring the same provider must not share a key.
func TestKeysAreKeptPerAgentAndProvider(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)

	const mine, theirs = "sk-test-opencode-key", "sk-test-other-key"
	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", mine); err != nil {
		t.Fatalf("store: %v", err)
	}
	// The other agent keeps no catalogue, so only a hand-written entry could ever collide.
	if err := keyring.Set(keyringProviderService, providerKeyringUser(airuntime.AgentClaude, "openai"), theirs); err != nil {
		t.Fatal(err)
	}

	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "openai"); got != mine {
		t.Errorf("opencode read %q, want its own key", got)
	}
	if got, _ := ReadProviderKey(airuntime.AgentClaude, "openai"); got != theirs {
		t.Errorf("claude read %q, want its own key", got)
	}
	// Signing one out must leave the other's alone.
	if err := DeleteAllProviderKeys(airuntime.AgentOpenCode); err != nil {
		t.Fatalf("delete all: %v", err)
	}
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "openai"); got != "" {
		t.Errorf("opencode still holds %q after a sign-out", got)
	}
	if got, _ := ReadProviderKey(airuntime.AgentClaude, "openai"); got != theirs {
		t.Errorf("claude lost its key to the other agent's sign-out: %q", got)
	}
}

// Delete removes both halves: an index entry with no key injects nothing, a key with no entry is invisible.
func TestDeletingOneProviderClearsBothSides(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]},
	  "groq":{"name":"Groq","env":["GROQ_API_KEY"]}
	}`)
	for id, key := range map[string]string{"openai": "sk-test-openai", "groq": "sk-test-groq"} {
		if err := StoreProviderKey(airuntime.AgentOpenCode, id, key); err != nil {
			t.Fatalf("store %s: %v", id, err)
		}
	}

	if err := DeleteProviderKey(airuntime.AgentOpenCode, "openai"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "openai"); got != "" {
		t.Errorf("the key survived the delete: %q", got)
	}
	configured, _ := ConfiguredProviders(airuntime.AgentOpenCode)
	if len(configured) != 1 || configured[0].ID != "groq" {
		t.Errorf("index = %+v, want groq alone", configured)
	}
	// Deleting it again is what a double click does, and a missing entry is not a failure.
	if err := DeleteProviderKey(airuntime.AgentOpenCode, "openai"); err != nil {
		t.Errorf("second delete: %v", err)
	}
	// A provider that never had one reads as absent, which is not an error either.
	if got, err := ReadProviderKey(airuntime.AgentOpenCode, "mistral"); got != "" || err != nil {
		t.Errorf("ReadProviderKey for an unconfigured provider = %q, %v; want empty and no error", got, err)
	}
}

// A Linux with no Secret Service refuses every key; without the file the user could add no provider at all.
func TestAKeyTheKeychainRefusesGoesToAFileOnLinux(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("the name org.freedesktop.secrets was not provided by any .service files"))
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]},
	  "groq":{"name":"Groq","env":["GROQ_API_KEY"]}
	}`)

	const key = "sk-test-not-a-real-key-0123456789"
	for id, k := range map[string]string{"openai": key, "groq": "gsk-test"} {
		if err := StoreProviderKey(airuntime.AgentOpenCode, id, k); err != nil {
			t.Fatalf("store %s: %v", id, err)
		}
	}
	path, err := providerKeyFilePath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("no key file: %v", err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Errorf("key file mode = %v, want 0600: only this user may read it", info.Mode().Perm())
	}
	if got, err := ReadProviderKey(airuntime.AgentOpenCode, "openai"); err != nil || got != key {
		t.Errorf("ReadProviderKey = %q, %v; want the key from the file", got, err)
	}
	env, err := providerEnv(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatalf("providerEnv: %v", err)
	}
	if !slices.Contains(env, "OPENAI_API_KEY="+key) {
		t.Errorf("env = %v, want the key from the file injected", env)
	}

	if err := DeleteProviderKey(airuntime.AgentOpenCode, "openai"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "openai"); got != "" {
		t.Errorf("the key survived the delete: %q", got)
	}
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "groq"); got != "gsk-test" {
		t.Errorf("deleting openai took groq's key too: %q", got)
	}
	if err := DeleteAllProviderKeys(airuntime.AgentOpenCode); err != nil {
		t.Fatalf("delete all: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("the key file outlived the sign-out (err=%v)", err)
	}
}

// Once the keychain works again, a key stored there must not leave its older copy on disk.
func TestAKeyTheKeychainTakesRemovesItsCopyFromTheFile(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("no secret service"))
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)
	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", "sk-test-old"); err != nil {
		t.Fatalf("store in the file: %v", err)
	}

	keyring.MockInit()
	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", "sk-test-new"); err != nil {
		t.Fatalf("store in the keychain: %v", err)
	}
	path, err := providerKeyFilePath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("the old copy stayed on disk (err=%v)", err)
	}
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "openai"); got != "sk-test-new" {
		t.Errorf("ReadProviderKey = %q, want the keychain's key", got)
	}
}

// macOS and Windows always have a keychain, so a refusal there is reported instead of written to disk.
func TestAKeyTheKeychainRefusesIsAnErrorElsewhere(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("the user denied access to the keychain"))
	withKeyFileFallback(t, false)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)

	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", "sk-test-not-a-real-key"); err == nil {
		t.Fatal("a key the keychain refused was reported as stored")
	}
	path, err := providerKeyFilePath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("the key was written to disk (err=%v)", err)
	}
	if configured, _ := ConfiguredProviders(airuntime.AgentOpenCode); len(configured) != 0 {
		t.Errorf("index = %+v, want no entry for a key that was never stored", configured)
	}
}

// A keychain that exists but stayed locked said no: the key must not be written to disk behind that answer.
func TestADismissedUnlockPromptKeepsTheKeyOffDisk(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("failed to unlock correct collection '/org/freedesktop/secrets/aliases/default'"))
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)

	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", "sk-test-not-a-real-key"); err == nil {
		t.Fatal("a key the user's locked keychain refused was reported as stored")
	}
	path, err := providerKeyFilePath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("the key was written to disk (err=%v)", err)
	}
}

// A keychain that refuses only sometimes can hold an older key than the file: the file's is the one the user gave last.
func TestAKeyInTheFileBeatsAnOlderOneInTheKeychain(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)
	if err := keyring.Set(keyringProviderService, providerKeyringUser(airuntime.AgentOpenCode, "openai"), "sk-test-old"); err != nil {
		t.Fatal(err)
	}
	if err := editProviderKeyFile(airuntime.AgentOpenCode, func(keys map[string]string) { keys["openai"] = "sk-test-new" }); err != nil {
		t.Fatal(err)
	}

	if got, err := ReadProviderKey(airuntime.AgentOpenCode, "openai"); err != nil || got != "sk-test-new" {
		t.Errorf("ReadProviderKey = %q, %v; want the file's newer key", got, err)
	}
}

// A file holding a JSON null decodes to no map at all, and the next store must still work.
func TestAKeyFileHoldingNullIsNoKeys(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("no secret service"))
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)
	path, err := providerKeyFilePath(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("null"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", "sk-test"); err != nil {
		t.Fatalf("store: %v", err)
	}
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "openai"); got != "sk-test" {
		t.Errorf("ReadProviderKey = %q, want the stored key", got)
	}
}

// Copilot's login is the engine's own file, so a board with no keychain must still remove it, alone or at sign-out.
func TestASignInProviderLeavesWithoutAKeychain(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the engine stand-in is a shell script")
	}
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("the name org.freedesktop.secrets was not provided by any .service files"))
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]},
	  "github-copilot":{"name":"GitHub Copilot","env":["GITHUB_TOKEN"]}
	}`)
	rt, err := airuntime.RuntimeDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	cli := filepath.Join(rt, "node_modules", ".bin", "opencode")
	if err := os.MkdirAll(filepath.Dir(cli), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cli, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := RecordProviderSignIn(airuntime.AgentOpenCode, "github-copilot"); err != nil {
		t.Fatal(err)
	}
	if err := SignOutProvider(airuntime.AgentOpenCode, "github-copilot"); err != nil {
		t.Errorf("removing Copilot alone: %v", err)
	}
	if configured, _ := ConfiguredProviders(airuntime.AgentOpenCode); len(configured) != 0 {
		t.Errorf("index = %+v, want Copilot gone", configured)
	}

	if err := RecordProviderSignIn(airuntime.AgentOpenCode, "github-copilot"); err != nil {
		t.Fatal(err)
	}
	if err := StoreProviderKey(airuntime.AgentOpenCode, "openai", "sk-test"); err != nil {
		t.Fatal(err)
	}
	if err := DeleteAllProviderKeys(airuntime.AgentOpenCode); err != nil {
		t.Errorf("sign-out with Copilot and a key in the file: %v", err)
	}
}

// A row whose key is gone from the file, after a corrupt file say, must still leave the list on a board with no keychain.
func TestARowWithNoKeyLeftCanBeRemovedWithoutAKeychain(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("the name org.freedesktop.secrets was not provided by any .service files"))
	withKeyFileFallback(t, true)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)
	if err := updateProviderIndex(airuntime.AgentOpenCode, "openai", true); err != nil {
		t.Fatal(err)
	}

	if err := DeleteProviderKey(airuntime.AgentOpenCode, "openai"); err != nil {
		t.Errorf("delete: %v", err)
	}
	if configured, _ := ConfiguredProviders(airuntime.AgentOpenCode); len(configured) != 0 {
		t.Errorf("index = %+v, want the row gone", configured)
	}
}

// Keys added at once must all stay listed: an entry missing from the index is never injected and never removed.
func TestKeysStoredAtOnceAllStayInTheIndex(t *testing.T) {
	isolatedAppData(t)
	keyring.MockInitWithError(errors.New("no secret service")) // the working mock is not safe for concurrent use
	withKeyFileFallback(t, true)
	const n = 12
	entries := make([]string, n)
	for i := range entries {
		entries[i] = fmt.Sprintf(`"p%d":{"name":"P%d","env":["P%d_API_KEY"]}`, i, i, i)
	}
	writeCatalogue(t, airuntime.AgentOpenCode, "{"+strings.Join(entries, ",")+"}")

	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		go func(i int) {
			errs <- StoreProviderKey(airuntime.AgentOpenCode, fmt.Sprintf("p%d", i), fmt.Sprintf("key-%d", i))
		}(i)
	}
	for i := 0; i < n; i++ {
		if err := <-errs; err != nil {
			t.Errorf("store: %v", err)
		}
	}
	if configured, _ := ConfiguredProviders(airuntime.AgentOpenCode); len(configured) != n {
		t.Errorf("index lists %d providers, want %d", len(configured), n)
	}
}

func withKeyFileFallback(t *testing.T, on bool) {
	t.Helper()
	orig := keyFileFallback
	keyFileFallback = on
	t.Cleanup(func() { keyFileFallback = orig })
}

// The id comes from the webview: storing under one the catalogue does not list would inject nothing.
func TestAKeyIsRefusedForAProviderTheCatalogueDoesNotList(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)

	for _, id := range []string{"", "no-such-provider", "OpenAI", "openai/../groq"} {
		if err := StoreProviderKey(airuntime.AgentOpenCode, id, "sk-test-not-a-real-key"); err == nil {
			t.Errorf("StoreProviderKey accepted the unlisted provider %q", id)
		}
		if _, err := ProviderByID(airuntime.AgentOpenCode, id); err == nil {
			t.Errorf("ProviderByID answered for the unlisted provider %q", id)
		}
	}
	if configured, _ := ConfiguredProviders(airuntime.AgentOpenCode); len(configured) != 0 {
		t.Errorf("a refused key still reached the index: %+v", configured)
	}
}

// A provider dropped from the catalogue since: nothing to inject, and nothing to show in settings.
func TestAProviderTheCatalogueForgotIsSkippedNotGuessedAt(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]},
	  "gone":{"name":"Gone Labs","env":["GONE_API_KEY"]}
	}`)
	for id, key := range map[string]string{"openai": "sk-test-openai", "gone": "sk-test-gone"} {
		if err := StoreProviderKey(airuntime.AgentOpenCode, id, key); err != nil {
			t.Fatalf("store %s: %v", id, err)
		}
	}
	writeCatalogue(t, airuntime.AgentOpenCode, `{"openai":{"name":"OpenAI","env":["OPENAI_API_KEY"]}}`)

	env, err := providerEnv(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatalf("providerEnv: %v", err)
	}
	if len(env) != 1 || !strings.HasPrefix(env[0], "OPENAI_API_KEY=") {
		t.Errorf("env = %v, want only the provider the catalogue still lists", env)
	}
	// Its key is still in the keychain, and its index entry still dates the connection.
	if got, _ := ReadProviderKey(airuntime.AgentOpenCode, "gone"); got == "" {
		t.Error("the forgotten provider's key was deleted; only the injection is skipped")
	}
}

// The panel offers App Lab's providers only, in its order, with the names and key pages App Lab chose.
func TestOnlyTheOfferedProvidersAreOfferedInThePanelsOrder(t *testing.T) {
	isolatedAppData(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{
	  "groq":           {"name":"Groq","env":["GROQ_API_KEY"]},
	  "google":         {"name":"Google","env":["GOOGLE_API_KEY"],"doc":"https://ai.google.dev/gemini-api/docs/models"},
	  "anthropic":      {"name":"Anthropic","env":["ANTHROPIC_API_KEY"]},
	  "github-copilot": {"name":"GitHub Copilot","env":["GITHUB_TOKEN"]},
	  "deepseek":       {"name":"DeepSeek","env":["DEEPSEEK_API_KEY"]},
	  "opencode":       {"name":"OpenCode Zen","env":["OPENCODE_API_KEY"]}
	}`)

	got, err := OfferedProviders(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, len(got))
	for _, p := range got {
		ids = append(ids, p.ID)
	}
	// openai and openrouter are missing from this catalogue: with nothing to inject a key into, they are left out.
	if want := "google,opencode,anthropic,github-copilot"; strings.Join(ids, ",") != want {
		t.Fatalf("offered %v, want %s", ids, want)
	}
	if g := got[0]; g.Name != "Google Gemini" || g.DocURL != "https://aistudio.google.com/apikey" || !g.FreeKey || g.SignIn || g.KeyPrefix != "AIza" {
		t.Errorf("google = %+v, want the Gemini name, the AI Studio key page, a free key, no sign-in and the AIza prefix", g)
	}
	if a := got[2]; a.KeyPrefix != "sk-ant-" {
		t.Errorf("anthropic key prefix = %q, want sk-ant-", a.KeyPrefix)
	}
	if c := got[3]; !c.SignIn || c.FreeKey {
		t.Errorf("copilot = %+v, want a sign-in", c)
	}
	// A key stored earlier for a provider no longer offered still resolves, so it keeps reaching the engine.
	if _, err := ProviderByID(airuntime.AgentOpenCode, "groq"); err != nil {
		t.Errorf("groq no longer resolves: %v", err)
	}
}

// Copilot is signed in to through the engine's own login; the other providers take a key.
func TestTheSignInCommandIsTheEnginesOwnLogin(t *testing.T) {
	args, input, err := ProviderSignIn(airuntime.AgentOpenCode, "github-copilot")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := strings.Join(args, "|"), "providers|login|--provider|github-copilot|--method|Login with GitHub Copilot"; got != want {
		t.Errorf("args = %q, want %q", got, want)
	}
	if input != "\r\n" {
		t.Errorf("input = %q, want Enter, which picks GitHub.com", input)
	}
	if _, _, err := ProviderSignIn(airuntime.AgentOpenCode, "anthropic"); err == nil {
		t.Error("a key provider was given a sign-in")
	}
	if IsSignInProvider(airuntime.AgentClaude, "github-copilot") {
		t.Error("Claude has no provider sign-ins")
	}
}

// Whether the engine holds a credential comes from its file's keys; the values are never decoded.
func TestEngineHasCredentialLooksAtTheKeysOnly(t *testing.T) {
	isolatedAppData(t)
	if ok, err := EngineHasCredential(airuntime.AgentOpenCode, "github-copilot"); err != nil || ok {
		t.Fatalf("no file: ok=%v err=%v, want false and no error", ok, err)
	}
	root, err := airuntime.AgentConfigDir(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, openCodeProfile.engineAuthFileRel)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	body := `{"github-copilot":{"type":"oauth","refresh":"not-a-real-token","access":"","expires":0}}`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	if ok, err := EngineHasCredential(airuntime.AgentOpenCode, "github-copilot"); err != nil || !ok {
		t.Errorf("copilot: ok=%v err=%v, want true", ok, err)
	}
	if ok, _ := EngineHasCredential(airuntime.AgentOpenCode, "anthropic"); ok {
		t.Error("anthropic reported as stored by the engine")
	}
}

// A signed-in provider is listed like a keyed one, and nothing goes to the keychain for it.
func TestASignedInProviderIsListedWithoutAKey(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	if err := RecordProviderSignIn(airuntime.AgentOpenCode, "github-copilot"); err != nil {
		t.Fatal(err)
	}
	configured, err := ConfiguredProviders(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	if len(configured) != 1 || configured[0].ID != "github-copilot" || configured[0].AddedAt.IsZero() {
		t.Fatalf("configured = %+v, want github-copilot with a date", configured)
	}
	if key, _ := ReadProviderKey(airuntime.AgentOpenCode, "github-copilot"); key != "" {
		t.Error("a sign-in put something in the keychain")
	}
}

// OpenCode forwards no key of a three-variable provider, and Google's SDK reads only GOOGLE_GENERATIVE_AI_API_KEY.
func TestAGeminiKeyGoesWhereGooglesSDKReadsIt(t *testing.T) {
	isolatedAppData(t)
	mockKeychain(t)
	writeCatalogue(t, airuntime.AgentOpenCode, `{"google":{"name":"Google","env":["GOOGLE_API_KEY","GOOGLE_GENERATIVE_AI_API_KEY","GEMINI_API_KEY"]}}`)
	if err := StoreProviderKey(airuntime.AgentOpenCode, "google", "not-a-real-key"); err != nil {
		t.Fatal(err)
	}
	env, err := providerEnv(airuntime.AgentOpenCode)
	if err != nil {
		t.Fatal(err)
	}
	got := strings.Join(env, " ")
	for _, want := range []string{"GOOGLE_GENERATIVE_AI_API_KEY=not-a-real-key", "GOOGLE_API_KEY=not-a-real-key"} {
		if !strings.Contains(got, want) {
			t.Errorf("env %q lacks %s", got, want)
		}
	}
}
