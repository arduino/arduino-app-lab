import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AgentDescriptor,
  AgentId,
  install,
  listAgents,
  onProgress,
  RuntimeProgress,
  status,
} from '../../../services';
import { useAiAssistantStore } from '../../../store';
import { restartForNewCredential } from '../utils/restartForNewCredential';

export interface ConnectPanelLogic {
  agents: AgentDescriptor[];
  // The card currently expanded into its auth options (after Connect).
  expandedId?: AgentId;
  // The card whose runtime is installing (Install button shows a spinner).
  installingId?: AgentId;
  // Per-agent runtime install state; undefined while the initial check runs.
  installedById: Partial<Record<AgentId, boolean>>;
  // Latest progress event emitted by the installing runtime.
  installProgress?: RuntimeProgress;
  toast?: string;
  dismissToast: VoidFunction;
  // Surface an auth error in the panel toast (passed to the shared auth flow).
  showError: (message: string) => void;
  // A success line for its own toast, as in Settings.
  notice?: string;
  dismissNotice: VoidFunction;
  // Where the provider form reports what went well: its failures stay on its own line, so none come here.
  notify: (message: string) => void;
  // Download + install the agent's runtime dependencies (shown when missing). Resolves to whether it
  // succeeded, so the caller can move straight on to the auth step.
  installRuntime: (agentId: AgentId) => Promise<boolean>;
  // Expand the card to the auth options (shown once the runtime is installed).
  connect: (agentId: AgentId) => void;
  // Collapse the expanded card (auth-flow reset is handled by the caller).
  cancel: VoidFunction;
  // Post-auth: start the agent and flip the store to the connected state.
  finishAuth: (agentId: AgentId) => Promise<void>;
}

const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const useConnectPanelLogic = (): ConnectPanelLogic => {
  const agents = useMemo(() => listAgents(), []);
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setJustConnected = useAiAssistantStore((s) => s.setJustConnected);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const setLastValidatedAt = useAiAssistantStore((s) => s.setLastValidatedAt);
  const installedById = useAiAssistantStore((s) => s.runtimeInstalled);
  const setRuntimeInstalled = useAiAssistantStore((s) => s.setRuntimeInstalled);

  const [expandedId, setExpandedId] = useState<AgentId>();
  const [installingId, setInstallingId] = useState<AgentId>();
  const [installProgress, setInstallProgress] = useState<RuntimeProgress>();
  const [toast, setToast] = useState<string>();
  const [notice, setNotice] = useState<string>();

  // Resolve each agent's runtime install state up front so the card can offer
  // Install (missing) or Connect (present). A failed check reads as missing.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      agents.map(async (agent): Promise<readonly [AgentId, boolean]> => {
        try {
          return [agent.id, (await status(agent.id)).installed];
        } catch {
          return [agent.id, false];
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        entries.forEach(([agentId, installed]) =>
          setRuntimeInstalled(agentId, installed),
        );
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [agents, setRuntimeInstalled]);

  // From a ref because the subscription is made once: another agent's install moved this card's bar.
  const installingIdRef = useRef<AgentId>();
  installingIdRef.current = installingId;
  useEffect(() => {
    try {
      return onProgress((event) => {
        const mine = installingIdRef.current;
        if (event.agent && mine && event.agent !== mine) {
          return;
        }
        setInstallProgress(event);
      });
    } catch {
      return undefined;
    }
  }, []);

  // Install click: download the runtime dependencies, then mark it installed so the card can move on
  // to the auth step (Connect is the fallback once the caller's auth flow is cancelled).
  const installRuntime = useCallback(
    async (agentId: AgentId): Promise<boolean> => {
      setInstallingId(agentId);
      setToast(undefined);
      setInstallProgress(undefined);
      try {
        await install(agentId);
        setRuntimeInstalled(agentId, true);
        return true;
      } catch (e) {
        setToast(errorText(e));
        return false;
      } finally {
        setInstallingId(undefined);
        setInstallProgress(undefined);
      }
    },
    [setRuntimeInstalled],
  );

  // Expanding a card is not choosing an agent: nothing has started yet, so nothing is named.
  const connect = useCallback((agentId: AgentId): void => {
    setToast(undefined);
    setExpandedId(agentId);
  }, []);

  const cancel = useCallback((): void => {
    setExpandedId(undefined);
    setToast(undefined);
  }, []);

  const finishAuth = useCallback(
    async (agentId: AgentId): Promise<void> => {
      await restartForNewCredential(agentId);
      setSessionExpired(false);
      setJustConnected(true);
      // The sign-in flow just proved the credential — mark it fresh so a quick re-entry skips the probe.
      setLastValidatedAt(Date.now());
      setAuth(agentId, { authenticated: true, agentId });
      // Not named here: restartForNewCredential moved the process, so it names it. One writer.
    },
    [setAuth, setJustConnected, setSessionExpired, setLastValidatedAt],
  );

  const dismissToast = useCallback((): void => setToast(undefined), []);
  const dismissNotice = useCallback((): void => setNotice(undefined), []);
  const notify = useCallback((message: string): void => setNotice(message), []);

  return {
    agents,
    expandedId,
    installingId,
    installedById,
    installProgress,
    toast,
    dismissToast,
    showError: setToast,
    notice,
    dismissNotice,
    notify,
    installRuntime,
    connect,
    cancel,
    finishAuth,
  };
};
