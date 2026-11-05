// Provider credentials for a bring-your-own-provider agent: several at once, one key each.

package agentauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/zalando/go-keyring"

	"app-lab-desktop/internal/airuntime"
)

// ConfiguredProvider is one provider the user has given a key, with when they gave it.
type ConfiguredProvider struct {
	ID      string    `json:"id"`
	AddedAt time.Time `json:"addedAt"`
}

// Provider is one entry of the engine's own catalogue.
type Provider struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	EnvVar string `json:"envVar"` // the variable the key is injected as
	DocURL string `json:"docUrl"` // where the user gets a key
	API    string `json:"api"`    // base URL, when the catalogue carries one: what a key check asks
	// Signed in on the provider's site through the engine's own login, instead of taking a key.
	SignIn bool `json:"signIn,omitempty"`
	// The provider gives a key for free, with usage limits.
	FreeKey bool `json:"freeKey,omitempty"`
	// How the provider's keys start, shown as the field's placeholder; empty when they share no prefix.
	KeyPrefix string `json:"keyPrefix,omitempty"`
	// The site that hands out a free key, named in the link to it.
	KeySite string `json:"keySite,omitempty"`
}

// OfferedProvider is one provider the settings panel offers, with what App Lab says differently from the catalogue.
type OfferedProvider struct {
	ID        string
	Name      string // where the catalogue's name is less clear
	KeyURL    string // the page that hands out a key, where the catalogue links elsewhere
	KeyPrefix string // how the provider's keys start
	KeySite   string // the site behind KeyURL, for a free key's link
	FreeKey   bool
	// The engine's login method label: set, the provider is signed in to rather than keyed.
	SignInMethod string
	// Typed into the login before anything else, to answer the questions it asks first.
	SignInInput string
	// Every variable the key goes into, where the engine does not read the catalogue's first one.
	KeyEnvs []string
}

// The providers App Lab offers for OpenCode, in the panel's order; the engine's free models need none of them.
var openCodeOffered = []OfferedProvider{
	// A free key, never a Google sign-in (against its terms); every variable, as OpenCode forwards no key of a three-variable provider.
	{ID: "google", Name: "Google Gemini", KeyURL: "https://aistudio.google.com/apikey", KeyPrefix: "AIza", KeySite: "Google AI Studio", FreeKey: true,
		KeyEnvs: []string{"GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"}},
	{ID: "opencode", KeyPrefix: "oc_sk_"},
	{ID: "anthropic", KeyURL: "https://platform.claude.com/login?returnTo=%2Fsettings%2Fkeys", KeyPrefix: "sk-ant-"},
	{ID: "openai", KeyURL: "https://platform.openai.com/api-keys", KeyPrefix: "sk-"},
	{ID: "openrouter", KeyURL: "https://openrouter.ai/settings/keys", KeyPrefix: "sk-or-"},
	// Enter answers the first question, which GitHub, with its first choice: GitHub.com.
	{ID: "github-copilot", SignInMethod: "Login with GitHub Copilot", SignInInput: "\r\n"},
}

// Which providers have a key, and when: ids and dates only, never the keys themselves.
const providerIndexFile = "provider-credentials.json"

// keyringProviderService namespaces one key per agent and provider, apart from the single-key agents above.
const keyringProviderService = "AppLab-agent-provider-apikey"

func providerKeyringUser(agent airuntime.AgentID, providerID string) string {
	return string(agent) + "/" + providerID
}

// Where the keys go on a Linux with no usable keychain (the UNO Q image ships no Secret Service): a file only this user reads.
const providerKeyFile = "provider-keys.json"

// keyFileFallback lets a key the keychain refuses go to providerKeyFile; a variable so tests run it on any platform.
var keyFileFallback = runtime.GOOS == "linux"

var providerKeyFileMu sync.Mutex

func providerKeyFilePath(agent airuntime.AgentID) (string, error) {
	dir, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, providerKeyFile), nil
}

// With the fallback on, any keychain error but go-keyring's for a dismissed unlock prompt means there is no keychain to hold a key.
func keychainMissing(err error) bool {
	return keyFileFallback && !strings.Contains(err.Error(), "failed to unlock")
}

// fileProviderKeys reads the keys kept in the file, by provider id.
func fileProviderKeys(agent airuntime.AgentID) (map[string]string, error) {
	path, err := providerKeyFilePath(agent)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("agentauth: read provider key file: %w", err)
	}
	var keys map[string]string
	// Like the index: an unreadable file is no keys, and the next write replaces it; a JSON null leaves the map nil.
	if err := json.Unmarshal(data, &keys); err != nil || keys == nil {
		return map[string]string{}, nil
	}
	return keys, nil
}

// editProviderKeyFile applies edit to the file's keys and writes them back; a file left with none is removed.
func editProviderKeyFile(agent airuntime.AgentID, edit func(keys map[string]string)) error {
	providerKeyFileMu.Lock()
	defer providerKeyFileMu.Unlock()
	keys, err := fileProviderKeys(agent)
	if err != nil {
		return err
	}
	edit(keys)
	path, err := providerKeyFilePath(agent)
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if len(keys) == 0 {
		for _, p := range []string{path, tmp} {
			if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("agentauth: remove provider key file: %w", err)
			}
		}
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.Marshal(keys)
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("agentauth: write provider key file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("agentauth: write provider key file: %w", err)
	}
	return nil
}

// The catalogue the engine caches for itself, so the list never goes stale against the engine.
func Providers(agent airuntime.AgentID) ([]Provider, error) {
	p, err := profileFor(agent)
	if err != nil {
		return nil, err
	}
	if p.providerCatalogRel == "" {
		return nil, nil
	}
	root, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return nil, err
	}
	return readProviderCatalog(filepath.Join(root, p.providerCatalogRel))
}

func readProviderCatalog(path string) ([]Provider, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Written on the engine's first run; before that there is genuinely nothing to offer.
			return nil, nil
		}
		return nil, fmt.Errorf("agentauth: read provider catalogue: %w", err)
	}
	var raw map[string]struct {
		Name string   `json:"name"`
		Env  []string `json:"env"`
		Doc  string   `json:"doc"`
		API  string   `json:"api"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("agentauth: parse provider catalogue: %w", err)
	}
	out := make([]Provider, 0, len(raw))
	for id, v := range raw {
		if len(v.Env) == 0 {
			continue // nothing to inject a key into
		}
		name := v.Name
		if name == "" {
			name = id
		}
		// The first is the canonical one; the rest are aliases the engine also accepts.
		out = append(out, Provider{ID: id, Name: name, EnvVar: v.Env[0], DocURL: v.Doc, API: v.API})
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

// FreeModels lists OpenCode Zen's models the catalogue prices at zero, by their session id ("opencode/model"); other providers bill the user's key.
func FreeModels(agent airuntime.AgentID) map[string]bool {
	p, err := profileFor(agent)
	if err != nil || p.providerCatalogRel == "" {
		return nil
	}
	root, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return nil
	}
	return freeModelsIn(filepath.Join(root, p.providerCatalogRel))
}

// freeModelsProvider is OpenCode Zen, the provider whose models need no key.
const freeModelsProvider = "opencode"

// The catalogue is several MB and read at every session open, so its free set is kept until the file changes.
var freeModelsCache struct {
	sync.Mutex
	path string
	mod  time.Time
	size int64
	free map[string]bool
}

func freeModelsIn(path string) map[string]bool {
	info, err := os.Stat(path)
	if err != nil {
		return nil
	}
	c := &freeModelsCache
	c.Lock()
	defer c.Unlock()
	if c.path == path && c.mod.Equal(info.ModTime()) && c.size == info.Size() {
		return c.free
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var raw map[string]struct {
		Models map[string]struct {
			Cost *struct {
				Input  *float64 `json:"input"`
				Output *float64 `json:"output"`
			} `json:"cost"`
		} `json:"models"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil
	}
	free := map[string]bool{}
	// Only the engine's own provider: another's zero price (a music model, an OpenRouter offer) still runs on the user's key.
	for modelID, model := range raw[freeModelsProvider].Models {
		if c := model.Cost; c != nil && c.Input != nil && c.Output != nil && *c.Input == 0 && *c.Output == 0 {
			free[freeModelsProvider+"/"+modelID] = true
		}
	}
	c.path, c.mod, c.size, c.free = path, info.ModTime(), info.Size(), free
	return free
}

// OfferedProviders is the offered part of the catalogue, in the panel's order; one the catalogue lacks has nothing to inject into.
func OfferedProviders(agent airuntime.AgentID) ([]Provider, error) {
	p, err := profileFor(agent)
	if err != nil {
		return nil, err
	}
	all, err := Providers(agent)
	if err != nil || len(p.offeredProviders) == 0 {
		return all, err
	}
	byID := make(map[string]Provider, len(all))
	for _, c := range all {
		byID[c.ID] = c
	}
	out := make([]Provider, 0, len(p.offeredProviders))
	for _, o := range p.offeredProviders {
		c, ok := byID[o.ID]
		if !ok {
			continue
		}
		if o.Name != "" {
			c.Name = o.Name
		}
		if o.KeyURL != "" {
			c.DocURL = o.KeyURL
		}
		c.FreeKey = o.FreeKey
		c.KeyPrefix = o.KeyPrefix
		c.KeySite = o.KeySite
		c.SignIn = o.SignInMethod != ""
		out = append(out, c)
	}
	return out, nil
}

func offeredProvider(agent airuntime.AgentID, providerID string) OfferedProvider {
	p, err := profileFor(agent)
	if err != nil {
		return OfferedProvider{}
	}
	for _, o := range p.offeredProviders {
		if o.ID == providerID {
			return o
		}
	}
	return OfferedProvider{}
}

// KeyPrefix is how the offered provider's keys start; empty when the panel knows none for it.
func KeyPrefix(agent airuntime.AgentID, providerID string) string {
	return offeredProvider(agent, providerID).KeyPrefix
}

// KeyOwner names the offered provider whose keys start like this one; none when the prefix fits several, as OpenAI's "sk-" does.
func KeyOwner(agent airuntime.AgentID, key string) (id, name string) {
	p, err := profileFor(agent)
	if err != nil {
		return "", ""
	}
	var owner OfferedProvider
	for _, o := range p.offeredProviders {
		if o.KeyPrefix != "" && strings.HasPrefix(key, o.KeyPrefix) && len(o.KeyPrefix) > len(owner.KeyPrefix) {
			owner = o
		}
	}
	if owner.ID == "" {
		return "", ""
	}
	for _, o := range p.offeredProviders {
		if o.ID != owner.ID && strings.HasPrefix(o.KeyPrefix, owner.KeyPrefix) {
			return "", "" // another provider's keys start the same way
		}
	}
	if c, err := providerByID(agent, owner.ID); err == nil {
		return owner.ID, c.Name
	}
	if owner.Name != "" {
		return owner.ID, owner.Name
	}
	return owner.ID, owner.ID
}

// IsSignInProvider reports whether the provider is signed in to through the engine rather than given a key.
func IsSignInProvider(agent airuntime.AgentID, providerID string) bool {
	return offeredProvider(agent, providerID).SignInMethod != ""
}

// ProviderSignIn is the CLI command that starts the engine's own login for a sign-in provider, and what to type into it first.
func ProviderSignIn(agent airuntime.AgentID, providerID string) (args []string, input string, err error) {
	o := offeredProvider(agent, providerID)
	if o.SignInMethod == "" {
		return nil, "", fmt.Errorf("agentauth: %s takes a key for %q, not a sign-in", agent, providerID)
	}
	return []string{"providers", "login", "--provider", providerID, "--method", o.SignInMethod}, o.SignInInput, nil
}

// EngineHasCredential reports whether the engine stored a credential for a provider, reading the file's keys, never the values.
func EngineHasCredential(agent airuntime.AgentID, providerID string) (bool, error) {
	p, err := profileFor(agent)
	if err != nil || p.engineAuthFileRel == "" {
		return false, err
	}
	root, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return false, err
	}
	data, err := os.ReadFile(filepath.Join(root, p.engineAuthFileRel))
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("agentauth: read engine credentials: %w", err)
	}
	var entries map[string]json.RawMessage
	if err := json.Unmarshal(data, &entries); err != nil {
		return false, fmt.Errorf("agentauth: parse engine credentials: %w", err)
	}
	_, ok := entries[providerID]
	return ok, nil
}

// RecordProviderSignIn lists a signed-in provider beside the keyed ones; its credential stays with the engine.
func RecordProviderSignIn(agent airuntime.AgentID, providerID string) error {
	return updateProviderIndex(agent, providerID, true)
}

// providerSignOutTimeout bounds the engine's logout, which only edits its own file.
const providerSignOutTimeout = 30 * time.Second

// SignOutProvider removes the engine's credential for a sign-in provider, then the provider from the list.
func SignOutProvider(agent airuntime.AgentID, providerID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), providerSignOutTimeout)
	defer cancel()
	if err := RunCLIStreaming(ctx, agent, Options{Method: None}, func(string) {}, nil, "providers", "logout", providerID); err != nil {
		return fmt.Errorf("agentauth: sign out of %s: %w", providerID, err)
	}
	// Its credential is the engine's own file, never a keychain entry, so a missing keychain must not fail this.
	return updateProviderIndex(agent, providerID, false)
}

// Fetches the catalogue when it is missing, which is every install before the engine's first launch.
func WarmProviderCatalog(ctx context.Context, agent airuntime.AgentID) error {
	p, err := profileFor(agent)
	if err != nil || p.providerCatalogRel == "" || len(p.catalogWarmupArgs) == 0 {
		return err
	}
	if list, lerr := Providers(agent); lerr == nil && len(list) > 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, catalogWarmupTimeout)
	defer cancel()
	return RunCLIStreaming(ctx, agent, Options{Method: None}, func(string) {}, nil, p.catalogWarmupArgs...)
}

// catalogWarmupTimeout bounds the fetch: the install is done either way, and the list can be filled later.
const catalogWarmupTimeout = 60 * time.Second

// ConfiguredProviders lists the providers that have a key stored, in the order they were added.
func ConfiguredProviders(agent airuntime.AgentID) ([]ConfiguredProvider, error) {
	path, err := providerIndexPath(agent)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("agentauth: read provider index: %w", err)
	}
	var idx struct {
		Providers []ConfiguredProvider `json:"providers"`
	}
	if err := json.Unmarshal(data, &idx); err != nil {
		return nil, nil // an unreadable index is no credentials, not an error the user can act on
	}
	return idx.Providers, nil
}

// FirstConfiguredAt is when this agent first got a credential: what "connected since" means for it.
func FirstConfiguredAt(agent airuntime.AgentID) time.Time {
	configured, err := ConfiguredProviders(agent)
	if err != nil {
		return time.Time{}
	}
	return earliestAddedAt(configured)
}

func earliestAddedAt(configured []ConfiguredProvider) time.Time {
	var first time.Time
	for _, c := range configured {
		if !c.AddedAt.IsZero() && (first.IsZero() || c.AddedAt.Before(first)) {
			first = c.AddedAt
		}
	}
	return first
}

// Unlike the single-key case, nothing keeps the key in memory: a key neither the keychain nor, on Linux, the file takes is an error.
func StoreProviderKey(agent airuntime.AgentID, providerID, key string) error {
	if _, err := providerByID(agent, providerID); err != nil {
		return err
	}
	if err := keyring.Set(keyringProviderService, providerKeyringUser(agent, providerID), key); err != nil {
		if !keychainMissing(err) {
			return fmt.Errorf("agentauth: store provider key: %w", err)
		}
		slog.Warn("no usable keychain; the provider key goes to a file only this user can read", "agent", agent, "provider", providerID, "err", err)
		if ferr := editProviderKeyFile(agent, func(keys map[string]string) { keys[providerID] = key }); ferr != nil {
			return fmt.Errorf("agentauth: store provider key: %w", ferr)
		}
	} else if keyFileFallback {
		// The keychain holds it now, so a copy an earlier run left in the file must not stay on disk.
		if ferr := editProviderKeyFile(agent, func(keys map[string]string) { delete(keys, providerID) }); ferr != nil {
			slog.Warn("a provider key copy stays in the key file", "agent", agent, "provider", providerID, "err", ferr)
		}
	}
	return updateProviderIndex(agent, providerID, true)
}

// DeleteProviderKey removes one provider's key and its index entry; a missing entry is not an error.
func DeleteProviderKey(agent airuntime.AgentID, providerID string) error {
	inFile := false
	if keyFileFallback {
		if err := editProviderKeyFile(agent, func(keys map[string]string) {
			_, inFile = keys[providerID]
			delete(keys, providerID)
		}); err != nil {
			return fmt.Errorf("agentauth: delete provider key: %w", err)
		}
	}
	err := keyring.Delete(keyringProviderService, providerKeyringUser(agent, providerID))
	// A key in the file is one the keychain refused, and a missing keychain holds none: either way its error says nothing.
	if err != nil && !errors.Is(err, keyring.ErrNotFound) && !inFile && !keychainMissing(err) {
		return fmt.Errorf("agentauth: delete provider key: %w", err)
	}
	return updateProviderIndex(agent, providerID, false)
}

// Every key at sign-out: the ones left behind would be injected again at the next start.
func DeleteAllProviderKeys(agent airuntime.AgentID) error {
	configured, err := ConfiguredProviders(agent)
	if err != nil || len(configured) == 0 {
		return err
	}
	var firstErr error
	var inFile map[string]string
	if keyFileFallback {
		inFile, _ = fileProviderKeys(agent) // unreadable or not, the file goes below
	}
	for _, c := range configured {
		if IsSignInProvider(agent, c.ID) {
			// Left signed in, the engine would keep using the account after the sign-out.
			if serr := SignOutProvider(agent, c.ID); serr != nil && firstErr == nil {
				firstErr = serr
			}
			continue
		}
		kerr := keyring.Delete(keyringProviderService, providerKeyringUser(agent, c.ID))
		if kerr != nil && !errors.Is(kerr, keyring.ErrNotFound) && inFile[c.ID] == "" && !keychainMissing(kerr) && firstErr == nil {
			firstErr = fmt.Errorf("agentauth: delete provider key: %w", kerr)
		}
	}
	if keyFileFallback {
		if ferr := editProviderKeyFile(agent, func(keys map[string]string) { clear(keys) }); ferr != nil && firstErr == nil {
			firstErr = fmt.Errorf("agentauth: delete provider key: %w", ferr)
		}
	}
	path, perr := providerIndexPath(agent)
	if perr != nil {
		return perr
	}
	if rerr := os.Remove(path); rerr != nil && !os.IsNotExist(rerr) && firstErr == nil {
		firstErr = fmt.Errorf("agentauth: clear provider index: %w", rerr)
	}
	return firstErr
}

// ReadProviderKey returns one provider's stored key, or "" when there is none.
func ReadProviderKey(agent airuntime.AgentID, providerID string) (string, error) {
	// The file first: a keychain store removes the file's copy, so a key still in the file is the newer one.
	if keyFileFallback {
		if keys, ferr := fileProviderKeys(agent); ferr == nil && keys[providerID] != "" {
			return keys[providerID], nil
		}
	}
	key, err := keyring.Get(keyringProviderService, providerKeyringUser(agent, providerID))
	if err == nil {
		return key, nil
	}
	if errors.Is(err, keyring.ErrNotFound) {
		return "", nil
	}
	return "", fmt.Errorf("agentauth: read provider key: %w", err)
}

// One variable per configured provider; one the catalogue no longer knows is skipped, not guessed at.
func providerEnv(agent airuntime.AgentID) ([]string, error) {
	configured, err := ConfiguredProviders(agent)
	if err != nil || len(configured) == 0 {
		return nil, err
	}
	catalogue, err := Providers(agent)
	if err != nil {
		return nil, err
	}
	envOf := make(map[string]string, len(catalogue))
	for _, p := range catalogue {
		envOf[p.ID] = p.EnvVar
	}
	out := make([]string, 0, len(configured))
	for _, c := range configured {
		env := envOf[c.ID]
		if env == "" {
			continue
		}
		key, err := ReadProviderKey(agent, c.ID)
		if err != nil || key == "" {
			continue // a key the keychain will not give back cannot be injected; the turn reports it
		}
		envs := offeredProvider(agent, c.ID).KeyEnvs
		if len(envs) == 0 {
			envs = []string{env}
		}
		for _, e := range envs {
			out = append(out, e+"="+key)
		}
	}
	return out, nil
}

// One entry of the catalogue: validates the id and carries what a key check needs.
func providerByID(agent airuntime.AgentID, providerID string) (Provider, error) {
	catalogue, err := Providers(agent)
	if err != nil {
		return Provider{}, err
	}
	for _, p := range catalogue {
		if p.ID == providerID {
			// The panel's name, so a refused Gemini key is not blamed on "Google".
			if o := offeredProvider(agent, providerID); o.Name != "" {
				p.Name = o.Name
			}
			return p, nil
		}
	}
	return Provider{}, fmt.Errorf("agentauth: %s has no provider %q", agent, providerID)
}

// ProviderByID is providerByID for callers outside this package.
func ProviderByID(agent airuntime.AgentID, providerID string) (Provider, error) {
	return providerByID(agent, providerID)
}

func providerIndexPath(agent airuntime.AgentID) (string, error) {
	dir, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, providerIndexFile), nil
}

// providerIndexMu serialises the index's read-modify-write: two stores at once each dropped the other's entry.
var providerIndexMu sync.Mutex

func updateProviderIndex(agent airuntime.AgentID, providerID string, present bool) error {
	providerIndexMu.Lock()
	defer providerIndexMu.Unlock()
	current, err := ConfiguredProviders(agent)
	if err != nil {
		return err
	}
	next := make([]ConfiguredProvider, 0, len(current)+1)
	for _, c := range current {
		if c.ID != providerID {
			next = append(next, c)
		}
	}
	if present {
		next = append(next, ConfiguredProvider{ID: providerID, AddedAt: time.Now().UTC()})
	}
	path, err := providerIndexPath(agent)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(struct {
		Providers []ConfiguredProvider `json:"providers"`
	}{next}, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("agentauth: write provider index: %w", err)
	}
	return os.Rename(tmp, path)
}
