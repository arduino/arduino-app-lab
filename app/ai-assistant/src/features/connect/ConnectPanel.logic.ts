import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AgentDescriptor,
  AgentId,
  install,
  listAgents,
  onProgress,
  RuntimeProgress,
  status,
} from '../../services';
import { useAiAssistantStore } from '../../store';
import { restartForNewCredential } from './restartForNewCredential';

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
  const setSelectedAgent = useAiAssistantStore((s) => s.setSelectedAgent);
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setJustConnected = useAiAssistantStore((s) => s.setJustConnected);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const setLastValidatedAt = useAiAssistantStore((s) => s.setLastValidatedAt);

  const [expandedId, setExpandedId] = useState<AgentId>();
  const [installingId, setInstallingId] = useState<AgentId>();
  const [installedById, setInstalledById] = useState<
    Partial<Record<AgentId, boolean>>
  >({});
  const [installProgress, setInstallProgress] = useState<RuntimeProgress>();
  const [toast, setToast] = useState<string>();

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
        setInstalledById(Object.fromEntries(entries));
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [agents]);

  // Mirror install progress events onto the active card.
  useEffect(() => {
    try {
      return onProgress(setInstallProgress);
    } catch {
      return undefined;
    }
  }, []);

  // Install click: download the runtime dependencies, then mark it installed so the card can move on
  // to the auth step (Connect is the fallback once the caller's auth flow is cancelled).
  const installRuntime = useCallback(
    async (agentId: AgentId): Promise<boolean> => {
      setSelectedAgent(agentId);
      setInstallingId(agentId);
      setToast(undefined);
      setInstallProgress(undefined);
      try {
        await install(agentId);
        setInstalledById((prev) => ({ ...prev, [agentId]: true }));
        return true;
      } catch (e) {
        setToast(errorText(e));
        return false;
      } finally {
        setInstallingId(undefined);
        setInstallProgress(undefined);
      }
    },
    [setSelectedAgent],
  );

  // Connect click: the runtime is already installed, so just expand the card to
  // its auth options.
  const connect = useCallback(
    (agentId: AgentId): void => {
      setSelectedAgent(agentId);
      setToast(undefined);
      setExpandedId(agentId);
    },
    [setSelectedAgent],
  );

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
      setAuth({ authenticated: true, agentId });
    },
    [setAuth, setJustConnected, setSessionExpired, setLastValidatedAt],
  );

  const dismissToast = useCallback((): void => setToast(undefined), []);

  return {
    agents,
    expandedId,
    installingId,
    installedById,
    installProgress,
    toast,
    dismissToast,
    showError: setToast,
    installRuntime,
    connect,
    cancel,
    finishAuth,
  };
};
