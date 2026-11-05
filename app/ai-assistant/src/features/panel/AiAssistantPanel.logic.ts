import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getAgent,
  isAuthError,
  parseAgentError,
  start,
  validateAuth,
} from '../../services';
import type { AgentDownReason } from '../../store';
import { currentAuth, useAiAssistantStore, useChatStore } from '../../store';
import { resolveAgentAuth } from '../connect/utils/resolveAgentAuth';
import {
  reviveAgent,
  subscribeAgentGiveUp,
  useAgentRevive,
} from './agentRestart';

// A validation is trusted this long, so the usual Editor<->Agent toggle skips the loader.
const AUTH_FRESH_MS = 900_000; // 15 minutes

export interface AiAssistantPanelLogic {
  loading: boolean;
  authenticated: boolean;
  agentDown: boolean;
  agentDownReason?: AgentDownReason;
  reconnecting: boolean;
  reconnect: VoidFunction;
  // Reviving on its own after a board switch the user confirmed — no prompt, just the loader.
  reviving: boolean;
}

// Picks the panel's screen (loader, reconnect, chat/connect) from the credential and agent liveness.
export const useAiAssistantPanelLogic = (): AiAssistantPanelLogic => {
  const auth = useAiAssistantStore(currentAuth);
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const authResolved = useAiAssistantStore((s) => s.authResolved);
  const setAuthResolved = useAiAssistantStore((s) => s.setAuthResolved);
  const setLastValidatedAt = useAiAssistantStore((s) => s.setLastValidatedAt);
  const agentDown = useAiAssistantStore((s) => s.agentDown);
  const setAgentDown = useAiAssistantStore((s) => s.setAgentDown);
  const setPickers = useAiAssistantStore((s) => s.setPickers);
  const reviving = useAgentRevive((s) => s.reviving);

  const freshOnMount = useMemo(() => {
    const state = useAiAssistantStore.getState();
    const a = currentAuth(state);
    const { lastValidatedAt } = state;
    return (
      a.authenticated &&
      lastValidatedAt !== undefined &&
      Date.now() - lastValidatedAt < AUTH_FRESH_MS
    );
  }, []);

  const [validating, setValidating] = useState(!freshOnMount);

  const reconnect = useCallback((): void => reviveAgent('manual'), []);

  // The host starts it at startup; the panel holds it as well, for a host that does not.
  useEffect(() => subscribeAgentGiveUp(), []);

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

    void resolveAgentAuth()
      .then(async (status) => {
        if (!active) {
          return;
        }

        if (!status?.authenticated) {
          setAuthResolved(true);
          setValidating(false);
          return;
        }

        let started = false;
        try {
          await start(status.agentId);
          started = true;
          setAgentDown(undefined); // a start that lands clears an earlier give-up
          // The sidebar read the list as it mounted, before the agent was running to answer it.
          useChatStore.getState().touchSessionList();
        } catch {
          // start failed — fall back to the connect flow (re-install/start).
        }

        if (!active) {
          return;
        }

        if (!started) {
          setAuth(status.agentId, { authenticated: false });
        } else {
          try {
            const opening = await validateAuth();
            // The probe's session also tells an empty chat what a new one starts with, without a second hidden session.
            if (opening.models?.length) {
              setPickers({
                models: opening.models,
                currentModelId: opening.modelId,
                modes: opening.modes ?? [],
                currentModeId: opening.modeId,
              });
              useChatStore.getState().setNewSessionPicks({
                modelId: opening.modelId,
                modeId: opening.modeId,
              });
            }
            if (active) {
              setAuth(status.agentId, status);
              setLastValidatedAt(Date.now());
            }
          } catch (e) {
            const { message, code } = parseAgentError(e);
            // An agent with a key per provider runs on its other providers and its free models.
            if (
              active &&
              isAuthError(message, code) &&
              !getAgent(status.agentId)?.perProviderKeys
            ) {
              setSessionExpired(true);
              setAuth(status.agentId, { authenticated: false });
            } else if (active) {
              setAuth(status.agentId, status); // couldn't verify (network) → open chat; prompt() still guards
            }
          }
        }

        if (active) {
          setAuthResolved(true);
          setValidating(false);
        }
      })
      .catch(() => {
        // The probe failed: without clearing these the panel sits on a loader nothing else resolves.
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
    setPickers,
  ]);

  return {
    // A stored `authenticated` is only trusted once this mount has confirmed it.
    loading: !authResolved || (validating && auth.authenticated),
    authenticated: auth.authenticated,
    agentDown: !!agentDown && auth.authenticated,
    agentDownReason: agentDown?.reason,
    reconnecting: reviving !== undefined,
    reconnect,
    reviving: reviving === 'auto',
  };
};
