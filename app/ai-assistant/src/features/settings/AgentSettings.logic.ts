import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AgentDescriptor,
  AgentId,
  AuthStatus,
  disconnect,
  getAgent,
  getAuthStatus,
  listAgents,
  setDefaultAgent,
} from '../../services';
import { useAiAssistantStore, useChatStore } from '../../store';
import { restartForNewCredential } from '../connect/restartForNewCredential';
import {
  type AgentAuthFlowState,
  useAgentAuthFlow,
} from '../connect/useAgentAuthFlow';
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
  // Pending confirmation dialog (disconnect/switch), if any.
  showConfirm?: { kind: ConfirmKind; agentId: AgentId };
  // The agent targeted by the pending confirmation.
  confirmTarget?: AgentDescriptor;
  // The agent currently set as default, for the switch dialog copy.
  currentDefaultAgent?: AgentDescriptor;
  // Only worth offering with more than one usable agent.
  showSetAsDefault: boolean;
  openConfirm: (kind: ConfirmKind, agentId: AgentId) => void;
  closeConfirm: VoidFunction;
  toggleManage: (agentId: AgentId) => void;
  // Reveal the login flow for an agent (Connect on a disconnected card).
  connect: (agentId: AgentId) => void;
  // Hide the login flow (Cancel).
  cancelFlow: VoidFunction;
  // Install the runtime, then drop straight into the login flow.
  install: (agentId: AgentId) => Promise<void>;
  // Sign out, then reveal the login flow so the user can reconnect.
  disconnectAgent: (agentId: AgentId) => Promise<void>;
  makeDefault: (agentId: AgentId) => Promise<void>;
  dismissError: VoidFunction;
  connectedAgent?: AgentDescriptor;
  dismissConnected: VoidFunction;
}

export const useAgentSettingsLogic = (): AgentSettingsLogic => {
  const agents = useMemo(() => listAgents(), []);
  const auth = useAiAssistantStore((s) => s.auth);
  const setAuth = useAiAssistantStore((s) => s.setAuth);
  const setLastValidatedAt = useAiAssistantStore((s) => s.setLastValidatedAt);
  const setSessionExpired = useAiAssistantStore((s) => s.setSessionExpired);
  const resetChat = useChatStore((s) => s.reset);

  const [expandedId, setExpandedId] = useState<AgentId>();
  const [authFlowId, setAuthFlowId] = useState<AgentId>();
  const [busyId, setBusyId] = useState<AgentId>();
  const [error, setError] = useState<string>();
  const [connectedAgentId, setConnectedAgentId] = useState<AgentId>();
  const [showConfirm, setShowConfirm] = useState<{
    kind: ConfirmKind;
    agentId: AgentId;
  }>();

  const confirmTarget = getAgent(showConfirm?.agentId);
  const currentDefaultAgent =
    auth.authenticated && auth.isDefault ? getAgent(auth.agentId) : undefined;
  const connectedAgent = getAgent(connectedAgentId);
  const showSetAsDefault =
    agents.filter((agent) => !agent.comingSoon).length > 1;

  // Pull the latest auth details on mount so the section reflects the real
  // account/date, not just the store's connected flag.
  useEffect(() => {
    let active = true;
    void getAuthStatus().then((status) => {
      if (active) {
        setAuth(status);
      }
    });
    return () => {
      active = false;
    };
  }, [setAuth]);

  const refresh = useCallback(async (): Promise<void> => {
    setAuth(await getAuthStatus());
  }, [setAuth]);

  const toggleManage = useCallback((agentId: AgentId): void => {
    setExpandedId((prev) => (prev === agentId ? undefined : agentId));
  }, []);

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
      setExpandedId(undefined);
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
        // Drop straight into the login flow so the user can reconnect.
        setAuthFlowId(agentId);
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

  const makeDefault = useCallback(
    async (agentId: AgentId): Promise<void> => {
      setBusyId(agentId);
      try {
        await setDefaultAgent(agentId);
        await refresh();
      } finally {
        setBusyId(undefined);
      }
    },
    [refresh],
  );

  const dismissError = useCallback((): void => setError(undefined), []);

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
  });

  const runtime = useRuntimePanel(agents, setError, signOut);

  // Connect/Cancel reset the shared auth flow so the tabs start fresh and any
  // in-flight sign-in is dropped.
  const connect = useCallback(
    (agentId: AgentId): void => {
      flow.reset();
      openAuthFlow(agentId);
    },
    [flow, openAuthFlow],
  );

  const cancelFlow = useCallback((): void => {
    flow.reset();
    closeAuthFlow();
  }, [flow, closeAuthFlow]);

  // A finished install leads straight into the auth options — signing in is the only thing left to
  // do, so the intermediate Connect button would just be an extra click. Cancelling the auth flow
  // falls back to the Connect CTA, since by then the runtime really is installed.
  const install = useCallback(
    async (agentId: AgentId): Promise<void> => {
      if (await runtime.installRuntime(agentId)) {
        connect(agentId);
      }
    },
    [runtime, connect],
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
        connectedAuth:
          !showAuthFlow && auth.authenticated && auth.agentId === agent.id
            ? auth
            : undefined,
        expanded: expandedId === agent.id,
        busy: busyId === agent.id,
        runtimeMissing: runtime.statusById[agent.id]?.installed === false,
        installingRuntime:
          runtime.operation?.agentId === agent.id &&
          runtime.operation.kind === 'install',
      };
    },
    [auth, authFlowId, expandedId, busyId, runtime],
  );

  return {
    agents,
    cardState,
    flow,
    runtime,
    error,
    showConfirm,
    confirmTarget,
    currentDefaultAgent,
    showSetAsDefault,
    openConfirm,
    closeConfirm,
    toggleManage,
    connect,
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
