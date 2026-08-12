// Detecting a persisted subscription login so a returning user skips the sign-in screen.

package agentauth

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"app-lab-desktop/internal/airuntime"
)

// claudeConfigFile is where the Claude CLI records the signed-in account in the (isolated) config dir.
const claudeConfigFile = ".claude.json"

// SubscriptionAccount is the persisted subscription login read from the isolated config.
type SubscriptionAccount struct {
	LoggedIn    bool   // a credential survives across restarts (token lives in the keychain)
	Email       string // account email, if recorded
	ConnectedAt string // approximate connect time (the CLI's first-start, ISO 8601)
}

// ReadSubscriptionAccount reads the agent's config dir for a persisted subscription login. A missing or unparseable config reads as not-logged-in; an invalid token still surfaces on the first prompt.
func ReadSubscriptionAccount(agent airuntime.AgentID) (SubscriptionAccount, error) {
	configDir, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return SubscriptionAccount{}, err
	}
	data, err := os.ReadFile(filepath.Join(configDir, claudeConfigFile))
	if err != nil {
		if os.IsNotExist(err) {
			return SubscriptionAccount{}, nil
		}
		return SubscriptionAccount{}, err
	}
	var cfg struct {
		FirstStartTime string `json:"firstStartTime"`
		OAuthAccount   struct {
			AccountUUID  string `json:"accountUuid"`
			EmailAddress string `json:"emailAddress"`
		} `json:"oauthAccount"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return SubscriptionAccount{}, nil
	}
	return SubscriptionAccount{
		LoggedIn:    cfg.OAuthAccount.AccountUUID != "" || cfg.OAuthAccount.EmailAddress != "",
		Email:       cfg.OAuthAccount.EmailAddress,
		ConnectedAt: cfg.FirstStartTime,
	}, nil
}

// cliLogoutTimeout bounds the CLI's own logout so a wedged process can't hang a sign-out.
const cliLogoutTimeout = 30 * time.Second

// SignOut removes the persisted subscription credential so ReadSubscriptionAccount reports not-logged-in AND the
// agent can no longer authenticate with it.
//
// Stripping oauthAccount from .claude.json removes only App Lab's *marker*. The live refresh token lives in the OS
// keychain (macOS/Windows) or in a file inside the isolated config dir (typically Linux), so on its own that left the
// UI saying "signed out" while a usable credential remained — and the next agent start would have picked it straight
// back up. Only the CLI can clear its own keychain entry, so its logout runs first; the credential file is removed
// too, both for the platforms that use one and for when the CLI is already gone (an uninstall).
//
// A failed CLI logout is reported rather than swallowed: App Lab is signed out either way, but a credential we could
// not clear is exactly what this prevents, so the caller must be able to say so. A CLI that isn't installed is not a
// failure — there is nothing left to log out of.
func SignOut(ctx context.Context, agent airuntime.AgentID) error {
	configDir, err := airuntime.AgentConfigDir(agent)
	if err != nil {
		return err
	}
	p, err := profileFor(agent)
	if err != nil {
		return err
	}

	var cliErr error
	if len(p.logoutArgs) > 0 {
		if _, statErr := cliCommand(agent); statErr == nil {
			logoutCtx, cancel := context.WithTimeout(ctx, cliLogoutTimeout)
			cliErr = RunCLIStreaming(logoutCtx, agent, Options{Method: None}, func(string) {}, nil, p.logoutArgs...)
			cancel()
			if cliErr != nil {
				slog.Warn("agent CLI logout failed; a credential may remain in the OS keychain", "agent", agent, "err", cliErr)
			}
		}
	}
	for _, name := range p.credentialFiles {
		if err := os.Remove(filepath.Join(configDir, name)); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("remove agent credential %s: %w", name, err)
		}
	}

	if err := stripOAuthMarker(filepath.Join(configDir, claudeConfigFile)); err != nil {
		return err
	}
	if cliErr != nil {
		return fmt.Errorf("signed out of App Lab, but the agent CLI could not clear its own stored credential: %w", cliErr)
	}
	return nil
}

// stripOAuthMarker removes the oauthAccount block App Lab reads as "logged in".
func stripOAuthMarker(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var cfg map[string]json.RawMessage
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil
	}
	if _, ok := cfg["oauthAccount"]; !ok {
		return nil
	}
	delete(cfg, "oauthAccount")
	out, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
