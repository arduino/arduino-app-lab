import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { messages } from '../../messages';
import {
  AgentDescriptor,
  AgentId,
  AuthStatus,
  connectWithoutKey,
  disconnect,
  getAgent,
  listAgents,
} from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { errorText } from '../connect/utils/errorText';
import { probeAgentAuth } from '../connect/utils/resolveAgentAuth';
import {
  restartAfterTurns,
  restartForNewCredential,
} from '../connect/utils/restartForNewCredential';
import {
  type AgentAuthFlowState,
  useAgentAuthFlow,
} from '../connect/utils/useAgentAuthFlow';
import { type RuntimePanelLogic, useRuntimePanel } from './RuntimePanel.logic';

// How long a failure toast stays up before clearing itself.
const ERROR_TOAST_MS = 6_000;

const ENGLISH_LOCALE = 'en-US';

export type ConfirmKind = 'disconnect' | 'switch';

type ConnectedAuth = Extract<AuthStatus, { authenticated: true }>;

// Everything one agent card needs to render, derived from the section state.
export interface AgentCardState {
  // The card is showing the login flow (Sign in / API key) — it wins over the details.
  showAuthFlow: boolean;
  // Auth details, when this agent is the connected one and the flow is closed.
  connectedAuth?: ConnectedAuth;
  // The "Manage" details are open.
  expanded: boolean;
  // An async action (disconnect / set-as-default) is running on this agent.
  busy: boolean;
  // Its runtime check came back missing → the card offers Install.
  runtimeMissing: boolean;
  installingRuntime: boolean;
}

export interface AgentSettingsLogic {
  agents: AgentDescriptor[];
  // Per-agent render state (connection, expansion, runtime), keyed off the section state.
  cardState: (agent: AgentDescriptor) => AgentCardState;
  // The shared Sign in / API Key surface, wired to this section.
  flow: AgentAuthFlowState;
  // Runtime & Packages state for the expanded card.
  runtime: RuntimePanelLogic;
  // Latest auth-flow error, shown in the section toast.
  error?: string;
  // A turn is in flight somewhere: the actions that respawn the agent are refused until it ends.
  turnRunning: boolean;
  // Pending confirmation dialog (disconnect/switch), if any.
  showConfirm?: { kind: ConfirmKind; agentId: AgentId };
  // The agent targeted by the pending confirmation.
  confirmTarget?: AgentDescriptor;
  // The agent the chat is talking to. Several can hold a credential; one runs.
  selectedAgentId?: AgentId;
  // The agent whose install just finished: its card offers Start building instead of Set as default.
  justInstalledId?: AgentId;
  // Used by Connect and by the switch dialog, so both take the same route.
  activate: (agentId: AgentId, openAfter?: boolean) => void;
  // Restarts the running agent so a provider key added or removed actually reaches it.
  reloadCredentials: (agentId: AgentId) => Promise<void>;
  // A success line for the toast, and the way to clear it.
  notice?: string;
  notify: (message: string, kind: 'error' | 'success') => void;
  dismissNotice: VoidFunction;
  // That agent's descriptor, when it has a credential: what copy means by "the one in use".
  inUseAgent?: AgentDescriptor;
  // Only worth offering with more than one usable agent.
  openConfirm: (kind: ConfirmKind, agentId: AgentId) => void;
  closeConfirm: VoidFunction;
  toggleManage: (agentId: AgentId) => void;
  // Reveal the login flow for an agent (Connect on a disconnected card).
  connect: (agentId: AgentId) => void;
  // Makes the agent the one in use without asking, then opens Agent mode.
  startBuilding: (agentId: AgentId) => void;
  // Hide the login flow (Cancel).
  cancelFlow: VoidFunction;
  // Install the runtime, then drop straight into the login flow.
  install: (agentId: AgentId) => Promise<void>;
  // Sign out, then reveal the login flow so the user can reconnect.
  disconnectAgent: (agentId: AgentId) => Promise<void>;
  // False when the switch failed; the toast already says why.
  makeDefault: (agentId: AgentId) => Promise<boolean>;
  dismissError: VoidFunction;
  connectedAgent?: AgentDescriptor;
  dismissConnected: VoidFunction;
}

// Narrows one agent's status to the authenticated shape a card renders.
const connectedAuthOf = (
  auth: Partial<Record<AgentId, AuthStatus>>,
  agentId: AgentId,
): Extract<AuthStatus, { authenticated: true }> | undefined => {
  const status = auth[agentId];
  return status?.authenticated ? status : undefined;
};

export const useAgentSettingsLogic = (
  // Opens Agent mode.
  onStartBuilding?: VoidFunction,
): AgentSettingsLogic => {
  const { formatMessage } = useI18n();
  const agents = useMemo(() => listAgents(), []);
  const auth = useAiAssistantStore((s) => s.auth);
  const setLastValidatedAt = useAiAssistantStore((s) => s.setLastValidatedAt);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const resetChat = useChatStore((s) => s.reset);
  // The restarts below kill the process mid-answer, so those actions are refused while a turn runs.
  const turnRunning = useChatStore((s) =>
    Object.values(s.streamingSessions).some(Boolean),
  );
  const restartingId = useAiAssistantStore((s) =>
    s.credentialRestart?.phase === 'restarting'
      ? s.credentialRestart.agentId
      : undefined,
  );

  const [expandedId, setExpandedId] = useState<AgentId>();
  const [authFlowId, setAuthFlowId] = useState<AgentId>();
  const [busyId, setBusyId] = useState<AgentId>();
  const [justInstalledId, setJustInstalledIdState] = useState<AgentId>();
  // Read by onAuthenticated, which closes every card and was created before the install ended.
  const justInstalledRef = useRef<AgentId>();
  const setJustInstalledId = useCallback((agentId?: AgentId): void => {
    justInstalledRef.current = agentId;
    setJustInstalledIdState(agentId);
  }, []);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [connectedAgentId, setConnectedAgentId] = useState<AgentId>();
  const [showConfirm, setShowConfirm] =
    useState<AgentSettingsLogic['showConfirm']>();

  const confirmTarget = getAgent(showConfirm?.agentId);
  // The default is whichever signed-in agent says it is — asked of each, because two can be signed in.
  const connectedAgent = getAgent(connectedAgentId);
  const selectedAgentId = useAiAssistantStore((s) => s.selectedAgentId);
  const inUseAgent =
    selectedAgentId && auth[selectedAgentId]?.authenticated
      ? getAgent(selectedAgentId)
      : undefined;

  // Probe, not resolve: re-deciding which agent is in use would overwrite it with the default.
  useEffect(() => {
    void probeAgentAuth();
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await probeAgentAuth();
  }, []);

  const toggleManage = useCallback(
    (agentId: AgentId): void => {
      setExpandedId((prev) => (prev === agentId ? undefined : agentId));
      // Only another card ends the install's step: reopening this one still offers Start building.
      if (justInstalledRef.current !== agentId) {
        setJustInstalledId(undefined);
      }
    },
    [setJustInstalledId],
  );

  const openAuthFlow = useCallback((agentId: AgentId): void => {
    setError(undefined);
    setExpandedId(undefined);
    setAuthFlowId(agentId);
  }, []);

  const closeAuthFlow = useCallback((): void => {
    setError(undefined);
    setAuthFlowId(undefined);
  }, []);

  const onAuthenticated = useCallback(
    async (agentId: AgentId): Promise<void> => {
      // Restart the agent BEFORE flipping auth: the chat panel stays mounted behind Settings, so the
      // moment refresh() reports authenticated it remounts the chat and opens a session — which fails
      // if the disconnect's AgentStop left no agent running. Mirrors ConnectPanel's finishAuth.
      await restartForNewCredential(agentId);
      setSessionExpired(false);
      setLastValidatedAt(Date.now());
      await refresh();
      setAuthFlowId(undefined);
      // A fresh install stays open: its provider list is the next step.
      setExpandedId(justInstalledRef.current === agentId ? agentId : undefined);
      setConnectedAgentId(agentId);
    },
    [refresh, setLastValidatedAt, setSessionExpired],
  );

  const signOutAndReveal = useCallback(
    async (agentId: AgentId): Promise<void> => {
      setBusyId(agentId);
      try {
        await disconnect(agentId);
        // Disconnect stopped the agent; drop the "recently validated" flag so returning to the Agent
        // panel does a full re-init (restart the agent + fresh session) instead of trusting the stale
        // cache — otherwise freshOnMount would skip start() and leave the chat pointing at a dead agent.
        setLastValidatedAt(undefined);
        resetChat(); // the restarted agent knows none of the cached sessions (persisted history is untouched)
        await refresh();
        setExpandedId(undefined);
        // Into the login flow, unless there is nothing to ask: a free agent reconnects from Connect.
        if (!getAgent(agentId)?.usableWithoutKey) {
          setAuthFlowId(agentId);
        }
      } finally {
        setBusyId(undefined);
      }
    },
    [refresh, setLastValidatedAt, resetChat],
  );

  const signOut = useCallback(
    async (agentId: AgentId): Promise<void> => {
      await disconnect(agentId);
      setLastValidatedAt(undefined); // agent stopped — force a full re-init on the next Agent-panel open
      resetChat(); // its sessions went with it (see disconnectAgent)
      await refresh();
      setExpandedId(undefined);
    },
    [refresh, setLastValidatedAt, resetChat],
  );

  // Also a move: switchAgent goes first and refuses while the workspace holds edits the board lacks.
  const makeDefault = useCallback(
    async (agentId: AgentId): Promise<boolean> => {
      setBusyId(agentId);
      try {
        // Switch, stop, start, name it, default it, and empty the chat: one reset, done in there.
        await restartForNewCredential(agentId);
        setLastValidatedAt(Date.now()); // it is running now; undefined would force another re-init
        await refresh();
        return true;
      } catch (e) {
        setError(errorText(e));
        return false;
      } finally {
        setBusyId(undefined);
      }
    },
    [refresh, setLastValidatedAt],
  );

  const dismissError = useCallback((): void => setError(undefined), []);
  const dismissNotice = useCallback((): void => setNotice(undefined), []);
  const notify = useCallback(
    (message: string, kind: 'error' | 'success'): void =>
      kind === 'error' ? setError(message) : setNotice(message),
    [],
  );

  // The failure toast is informational and has no action, so it shouldn't sit over the panel forever: give the user
  // time to read it, then clear it. Dismissing by hand still works, and a new failure restarts the timer.
  useEffect(() => {
    if (error === undefined) {
      return;
    }
    const timer = setTimeout(() => setError(undefined), ERROR_TOAST_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const dismissConnected = useCallback(
    (): void => setConnectedAgentId(undefined),
    [],
  );

  const openConfirm = useCallback(
    (kind: ConfirmKind, agentId: AgentId): void =>
      setShowConfirm({ kind, agentId }),
    [],
  );

  const closeConfirm = useCallback((): void => setShowConfirm(undefined), []);

  const flow = useAgentAuthFlow({
    agent: getAgent(authFlowId),
    onAuthenticated,
    onError: setError,
    place: formatMessage(messages.placeSettings),
  });

  const onUninstalled = useCallback(
    async (agentId: AgentId): Promise<void> => {
      await signOut(agentId);
      if (authFlowId === agentId) {
        flow.reset();
        closeAuthFlow();
      }
    },
    [signOut, authFlowId, flow, closeAuthFlow],
  );

  const runtime = useRuntimePanel(agents, setError, onUninstalled);

  // Keys reach the engine at spawn: without a restart that provider's models never appear.
  const reloadCredentials = useCallback(
    async (agentId: AgentId): Promise<void> => {
      if (agentId !== useAiAssistantStore.getState().selectedAgentId) {
        return; // not the running one: its next start reads the keys anyway
      }
      try {
        if (await restartAfterTurns(agentId)) {
          setLastValidatedAt(Date.now());
        }
      } catch (e) {
        setError(errorText(e));
      }
    },
    [setLastValidatedAt],
  );

  // Makes an agent the one in use, with nothing left to ask the user.
  const activate = useCallback(
    (agentId: AgentId, openAfter?: boolean): void => {
      const open = (ok: boolean): void => {
        if (ok && openAfter) {
          onStartBuilding?.();
        }
      };
      if (auth[agentId]?.authenticated) {
        void makeDefault(agentId).then(open);
        return;
      }
      // Free models: the connection is the choice, so record it and start.
      setBusyId(agentId);
      void connectWithoutKey(agentId)
        .then(() => onAuthenticated(agentId))
        .then(() => open(true))
        .catch((e: unknown) => setError(errorText(e)))
        .finally(() => setBusyId(undefined));
    },
    [auth, makeDefault, onAuthenticated, onStartBuilding],
  );

  const connect = useCallback(
    (agentId: AgentId): void => {
      flow.reset();
      const ready =
        auth[agentId]?.authenticated || getAgent(agentId)?.usableWithoutKey;
      // Confirm the switch, not the credential: a free agent disabled the other one with no warning.
      if (ready && inUseAgent && inUseAgent.id !== agentId) {
        openConfirm('switch', agentId);
        return;
      }
      if (ready) {
        activate(agentId);
        return;
      }
      // No credential and none offered for free: the sign-in comes first, and it switches at the end.
      openAuthFlow(agentId);
    },
    [activate, auth, flow, inUseAgent, openAuthFlow, openConfirm],
  );

  // Pressing it is the choice, so the switch is not confirmed.
  const startBuilding = useCallback(
    (agentId: AgentId): void => {
      if (inUseAgent?.id === agentId) {
        onStartBuilding?.();
        return;
      }
      activate(agentId, true);
    },
    [activate, inUseAgent, onStartBuilding],
  );

  const cancelFlow = useCallback((): void => {
    flow.reset();
    closeAuthFlow();
    setJustInstalledId(undefined);
  }, [flow, closeAuthFlow, setJustInstalledId]);

  // A finished install leads straight into the auth options — signing in is the only thing left to
  // do, so the intermediate Connect button would just be an extra click. Cancelling the auth flow
  // falls back to the Connect CTA, since by then the runtime really is installed.
  // A free agent has nothing to sign in to: installed, it is connected, and offers Manage without taking over from the one in use.
  const install = useCallback(
    async (agentId: AgentId): Promise<void> => {
      if (!(await runtime.installRuntime(agentId))) {
        return;
      }
      // Only an agent with a provider list has a next step to open on.
      if (getAgent(agentId)?.perProviderKeys) {
        setJustInstalledId(agentId);
      }
      if (
        getAgent(agentId)?.usableWithoutKey &&
        inUseAgent &&
        inUseAgent.id !== agentId
      ) {
        setBusyId(agentId);
        try {
          await connectWithoutKey(agentId);
          await refresh();
          if (justInstalledRef.current === agentId) {
            setExpandedId(agentId);
          }
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusyId(undefined);
        }
        return;
      }
      connect(agentId);
    },
    [runtime, connect, inUseAgent, refresh, setJustInstalledId],
  );

  const disconnectAgent = useCallback(
    async (agentId: AgentId): Promise<void> => {
      await signOutAndReveal(agentId);
      flow.reset();
    },
    [signOutAndReveal, flow],
  );

  const cardState = useCallback(
    (agent: AgentDescriptor): AgentCardState => {
      const showAuthFlow = authFlowId === agent.id;
      return {
        showAuthFlow,
        connectedAuth: showAuthFlow
          ? undefined
          : connectedAuthOf(auth, agent.id),
        expanded: expandedId === agent.id,
        // A restart for a key change counts too, from the store: it outlives this page.
        busy: busyId === agent.id || restartingId === agent.id,
        runtimeMissing: runtime.statusById[agent.id]?.installed === false,
        installingRuntime:
          runtime.operation?.agentId === agent.id &&
          runtime.operation.kind === 'install',
      };
    },
    [auth, authFlowId, expandedId, busyId, restartingId, runtime],
  );

  return {
    agents,
    cardState,
    flow,
    runtime,
    error,
    turnRunning,
    showConfirm,
    confirmTarget,
    selectedAgentId,
    justInstalledId,
    inUseAgent,
    activate,
    reloadCredentials,
    notice,
    notify,
    dismissNotice,
    openConfirm,
    closeConfirm,
    toggleManage,
    connect,
    startBuilding,
    cancelFlow,
    install,
    disconnectAgent,
    makeDefault,
    dismissError,
    connectedAgent,
    dismissConnected,
  };
};

// Absolute date for the "Connected" detail row, e.g. "June 2, 2026".
export const formatConnectedDate = (iso?: string): string => {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(ENGLISH_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Relative date for the status line, e.g. "2 days ago". Undefined when unknown.
export const formatConnectedAgo = (iso?: string): string | undefined => {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(ENGLISH_LOCALE, {
    numeric: 'auto',
  });
  const days = Math.round(diffMs / 86_400_000);
  if (Math.abs(days) >= 1) {
    return rtf.format(days, 'day');
  }
  const hours = Math.round(diffMs / 3_600_000);
  if (Math.abs(hours) >= 1) {
    return rtf.format(hours, 'hour');
  }
  return rtf.format(Math.round(diffMs / 60_000), 'minute');
};
