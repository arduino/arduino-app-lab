import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AgentDescriptor,
  AgentId,
  cancelInstall,
  checkForUpdate,
  install,
  onProgress,
  RuntimeProgress,
  RuntimeStatus,
  status,
  uninstall,
} from '../../services';

// Which long-running runtime op is in flight (drives the progress label).
export type RuntimeOperation = 'install' | 'update' | 'uninstall';

// How long the "Up to date" note stays before the Check-for-updates button
// returns — long enough that it reads as a persistent state, not a toast.
const UP_TO_DATE_MS = 5 * 60 * 1000;

export interface RuntimePanelLogic {
  // Per-agent runtime status; an entry is absent until its first fetch resolves.
  statusById: Partial<Record<AgentId, RuntimeStatus>>;
  // Which agent's "Runtime & Packages" section is expanded, if any.
  expandedId?: AgentId;
  // The single in-flight op (install/update/uninstall) and its target agent.
  operation?: { agentId: AgentId; kind: RuntimeOperation };
  // Progress of the running op, mirrored from onProgress.
  progress?: RuntimeProgress;
  // Agent whose update check is in flight.
  checkingId?: AgentId;
  // Agent whose recent check found it already up to date (transient note).
  upToDateId?: AgentId;
  // Agent whose uninstall confirmation dialog is open.
  confirmingUninstallId?: AgentId;
  toggle: (agentId: AgentId) => void;
  // Download + install the runtime (shown when it is missing). Resolves to whether it completed,
  // so the caller can move straight on to the auth step (false when cancelled or errored).
  installRuntime: (agentId: AgentId) => Promise<boolean>;
  // Probe the channel; auto-runs the update when a newer version exists.
  checkForUpdates: (agentId: AgentId) => Promise<void>;
  openUninstall: (agentId: AgentId) => void;
  closeUninstall: VoidFunction;
  // Run the uninstall (after confirmation).
  runUninstall: (agentId: AgentId) => Promise<void>;
  // Abort the in-flight op for the agent.
  cancelOperation: (agentId: AgentId) => Promise<void>;
}

const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const useRuntimePanel = (
  agents: AgentDescriptor[],
  onError: (message: string) => void,
  // Called after a successful uninstall so the caller can also sign the agent
  // out (the runtime is gone, so the flow restarts at Install → Connect).
  onUninstalled: (agentId: AgentId) => void | Promise<void>,
): RuntimePanelLogic => {
  const [statusById, setStatusById] = useState<
    Partial<Record<AgentId, RuntimeStatus>>
  >({});
  const [expandedId, setExpandedId] = useState<AgentId>();
  const [operation, setOperation] = useState<RuntimePanelLogic['operation']>();
  const [progress, setProgress] = useState<RuntimeProgress>();
  const [checkingId, setCheckingId] = useState<AgentId>();
  const [upToDateId, setUpToDateId] = useState<AgentId>();
  const [confirmingUninstallId, setConfirmingUninstallId] = useState<AgentId>();

  // Set right before we ask the service to cancel, so the op's rejection is
  // recognised as a user cancel and swallowed rather than surfaced as an error.
  const cancelledRef = useRef(false);

  const refresh = useCallback(async (agentId: AgentId): Promise<void> => {
    try {
      const next = await status(agentId);
      setStatusById((prev) => ({ ...prev, [agentId]: next }));
    } catch {
      // Leave the last known status in place on a failed refresh.
    }
  }, []);

  // Resolve every agent's runtime status up front so each card can pick
  // Install / Connect / Manage without waiting on expansion.
  useEffect(() => {
    agents.forEach((agent) => void refresh(agent.id));
  }, [agents, refresh]);

  // Mirror progress events while an op is running.
  useEffect(() => {
    try {
      return onProgress(setProgress);
    } catch {
      return undefined;
    }
  }, []);

  const toggle = useCallback(
    (agentId: AgentId): void =>
      setExpandedId((prev) => (prev === agentId ? undefined : agentId)),
    [],
  );

  // Shared runner for the progress-bar ops. Returns whether it completed
  // (false when cancelled or errored) so callers can chain follow-ups.
  const run = useCallback(
    async (
      agentId: AgentId,
      kind: RuntimeOperation,
      action: () => Promise<void>,
    ): Promise<boolean> => {
      cancelledRef.current = false;
      // Any install/update/uninstall invalidates a previous "up to date"
      // confirmation for this agent.
      setUpToDateId((prev) => (prev === agentId ? undefined : prev));
      setOperation({ agentId, kind });
      setProgress(undefined);
      try {
        await action();
        await refresh(agentId);
        return true;
      } catch (e) {
        if (!cancelledRef.current) {
          onError(errorText(e));
        }
        return false;
      } finally {
        cancelledRef.current = false;
        setOperation(undefined);
        setProgress(undefined);
      }
    },
    [refresh, onError],
  );

  const installRuntime = useCallback(
    async (agentId: AgentId): Promise<boolean> =>
      run(agentId, 'install', () => install(agentId)),
    [run],
  );

  const flashUpToDate = useCallback((agentId: AgentId): void => {
    setUpToDateId(agentId);
    setTimeout(() => setUpToDateId(undefined), UP_TO_DATE_MS);
  }, []);

  const checkForUpdates = useCallback(
    async (agentId: AgentId): Promise<void> => {
      setUpToDateId(undefined);
      setCheckingId(agentId);
      let updateAvailable = false;
      try {
        updateAvailable = (await checkForUpdate(agentId)).updateAvailable;
      } catch (e) {
        onError(errorText(e));
        return;
      } finally {
        setCheckingId(undefined);
      }
      if (updateAvailable) {
        // Install the update, then reflect that the runtime is now current.
        const ok = await run(agentId, 'update', () => install(agentId));
        if (ok) {
          flashUpToDate(agentId);
        }
      } else {
        flashUpToDate(agentId);
      }
    },
    [run, onError, flashUpToDate],
  );

  const openUninstall = useCallback(
    (agentId: AgentId): void => setConfirmingUninstallId(agentId),
    [],
  );
  const closeUninstall = useCallback(
    (): void => setConfirmingUninstallId(undefined),
    [],
  );

  const runUninstall = useCallback(
    async (agentId: AgentId): Promise<void> => {
      setConfirmingUninstallId(undefined);
      const ok = await run(agentId, 'uninstall', () => uninstall(agentId));
      // Uninstalling removes the runtime the agent runs on, so sign it out too:
      // the card falls back to the Install → Connect flow.
      if (ok) {
        setExpandedId(undefined);
        await onUninstalled(agentId);
      }
    },
    [run, onUninstalled],
  );

  const cancelOperation = useCallback(
    async (agentId: AgentId): Promise<void> => {
      cancelledRef.current = true;
      try {
        await cancelInstall(agentId);
      } catch {
        // Best-effort: the op's own rejection path resets the running state.
      }
    },
    [],
  );

  return {
    statusById,
    expandedId,
    operation,
    progress,
    checkingId,
    upToDateId,
    confirmingUninstallId,
    toggle,
    installRuntime,
    checkForUpdates,
    openUninstall,
    closeUninstall,
    runUninstall,
    cancelOperation,
  };
};

// Human-readable on-disk size, e.g. "142 MB". Undefined when unknown.
export const formatDiskUsage = (bytes?: number): string | undefined => {
  if (bytes === undefined) {
    return undefined;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
};
