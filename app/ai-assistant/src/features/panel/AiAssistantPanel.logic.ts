import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getAuthStatus,
  isAuthError,
  onRestart,
  parseAgentError,
  start,
  validateAuth,
} from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';

// A validation is trusted this long, so the usual Editor<->Agent toggle skips the loader.
const AUTH_FRESH_MS = 900_000; // 15 minutes

export interface AiAssistantPanelLogic {
  loading: boolean;
  authenticated: boolean;
  agentDown: boolean;
  agentDownReason?: 'crashed' | 'board-changed';
  reconnecting: boolean;
  reconnect: VoidFunction;
}

// Picks the panel's screen (loader, reconnect, chat/connect) from the credential and agent liveness.
export const useAiAssistantPanelLogic = (): AiAssistantPanelLogic => {
  const auth = useAiAssistantStore((s) => s.auth);
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const authResolved = useAiAssistantStore((s) => s.authResolved);
  const setAuthResolved = useAiAssistantStore((s) => s.setAuthResolved);
  const setLastValidatedAt = useAiAssistantStore((s) => s.setLastValidatedAt);
  const agentDown = useAiAssistantStore((s) => s.agentDown);
  const agentDownReason = useAiAssistantStore((s) => s.agentDownReason);
  const setAgentDown = useAiAssistantStore((s) => s.setAgentDown);
  const [reconnecting, setReconnecting] = useState(false);

  const freshOnMount = useMemo(() => {
    const { auth: a, lastValidatedAt } = useAiAssistantStore.getState();
    return (
      a.authenticated &&
      lastValidatedAt !== undefined &&
      Date.now() - lastValidatedAt < AUTH_FRESH_MS
    );
  }, []);

  const [validating, setValidating] = useState(!freshOnMount);

  // Only the give-up matters: the earlier events fire before each relaunch, so they say nothing yet.
  useEffect(
    () =>
      onRestart((restart) => {
        if (!restart.gaveUp) {
          return;
        }
        useChatStore.getState().resetLoadedSessions(); // the replacement process has none loaded
        setAgentDown(
          true,
          restart.reason === 'board-changed' ? 'board-changed' : 'crashed',
        );
      }),
    [setAgentDown],
  );

  // Clearing agentDown remounts the chat, which replays the last session.
  const reconnect = useCallback((): void => {
    void (async (): Promise<void> => {
      const { auth: current } = useAiAssistantStore.getState();
      if (!current.authenticated) {
        return;
      }
      setReconnecting(true);
      try {
        await start(current.agentId);
        setAgentDown(false);
      } catch {
        // Still down: the prompt stays put so the user can retry.
      } finally {
        setReconnecting(false);
      }
    })();
  }, [setAgentDown]);

  // Re-probes on every mount, so an expired/revoked token is caught before the chat opens.
  useEffect(() => {
    // Skip the probe and slide the window, so continuous toggling keeps skipping the loader.
    if (freshOnMount) {
      // Signing in from Settings marks the credential fresh without mounting this panel, so without
      // this the first open would hang on the loader.
      setAuthResolved(true);
      setLastValidatedAt(Date.now());
      return;
    }
    let active = true;

    void getAuthStatus().then(async (status) => {
      if (!active) {
        return;
      }

      if (!status.authenticated) {
        setAuth({ authenticated: false });
        setAuthResolved(true);
        setValidating(false);
        return;
      }

      let started = false;
      try {
        await start(status.agentId);
        started = true;
        setAgentDown(false); // a start that lands clears an earlier give-up
      } catch {
        // start failed — fall back to the connect flow (re-install/start).
      }

      if (!active) {
        return;
      }

      if (!started) {
        setAuth({ authenticated: false });
      } else {
        try {
          await validateAuth();
          if (active) {
            setAuth(status);
            setLastValidatedAt(Date.now());
          }
        } catch (e) {
          const { message, code } = parseAgentError(e);
          if (active && isAuthError(message, code)) {
            setSessionExpired(true);
            setAuth({ authenticated: false });
          } else if (active) {
            setAuth(status); // couldn't verify (network) → open chat; prompt() still guards
          }
        }
      }

      if (active) {
        setAuthResolved(true);
        setValidating(false);
      }
    });
    return () => {
      active = false;
    };
  }, [
    freshOnMount,
    setAuth,
    setSessionExpired,
    setAuthResolved,
    setLastValidatedAt,
    setAgentDown,
  ]);

  return {
    // A stored `authenticated` is only trusted once this mount has confirmed it.
    loading: !authResolved || (validating && auth.authenticated),
    authenticated: auth.authenticated,
    agentDown: agentDown && auth.authenticated,
    agentDownReason,
    reconnecting,
    reconnect,
  };
};
