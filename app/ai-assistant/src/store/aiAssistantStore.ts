import { create } from 'zustand';

import {
  AgentId,
  AgentMode,
  AgentModel,
  AuthStatus,
  getAgent,
} from '../services';

// Last models/modes advertised by a session, cached so re-opening the chat can render the pickers
// immediately (from cache) instead of leaving the toolbar empty until getSessionState resolves.
export interface CachedPickers {
  models: AgentModel[];
  currentModelId?: string;
  modes: AgentMode[];
  currentModeId?: string;
}

// Why the agent is down; the host's own teardowns (board changed or reflashed) are worded apart from a crash.
export type AgentDownReason =
  | 'crashed'
  | 'start-failed'
  | 'board-changed'
  | 'board-flashed';

// The agent that stopped, and why.
export interface AgentDown {
  agentId: AgentId;
  reason: AgentDownReason;
}

// A restart that hands a new key or a new agent to the engine: it waits for the turns in flight, then restarts.
export interface CredentialRestart {
  agentId: AgentId;
  phase: 'waiting' | 'restarting';
}

// A session mutation the backend rejected, reported by the chat's toast area (the side panel has no
// layer of its own).
export type SessionActionError = 'rename' | 'pin' | 'delete';

interface AiAssistantStore {
  // The agent in use: whose auth, whose sessions, whose crash. Written by whatever moved the process.
  selectedAgentId?: AgentId;
  // Per agent: both can be signed in at once, and Settings shows a card for each.
  auth: Partial<Record<AgentId, AuthStatus>>;
  // Set the moment auth succeeds; the chat shows a one-off "connected" toast
  // and clears it. Not part of `auth` so it stays a transient signal.
  justConnected: boolean;
  // Set when a turn fails auth (token expired/revoked) and we drop back to connect, so it shows why.
  sessionExpired: boolean;
  // True once the initial auth probe has completed at least once this session. Persisted in the
  // store (not panel-local) so re-opening the panel skips the full-screen loader and re-validates
  // in the background instead of flashing the loading splash every time.
  authResolved: boolean;
  // Timestamp (ms) of the last successful auth validation. Re-opening the panel within
  // AUTH_FRESH_MS of this trusts the credential and shows the chat instantly (no re-validation,
  // no loading splash); older than that re-validates with the loader. Undefined until first success.
  lastValidatedAt?: number;
  // Go ran out of restart attempts; names the agent, since reviving has to restart that one.
  agentDown?: AgentDown;
  // Cached picker options from the most recent session, to avoid an empty toolbar (and layout shift)
  // while a freshly opened chat waits for its session state.
  // Stamped with the agent that advertised them, or a switch renders one engine's models for another.
  pickers?: CachedPickers & { agentId?: AgentId };
  // Set by the side panel when a rename/pin/delete is rejected; the chat shows it and clears it.
  sessionActionError?: SessionActionError;
  // Whether each agent's runtime is on disk. Shared: Agent Mode stays mounted while Settings installs or uninstalls.
  runtimeInstalled: Partial<Record<AgentId, boolean>>;
  // The running provider sign-in and its form: Connect and Settings each mount one, and a second login cancels the first.
  providerSignIn?: {
    agentId: AgentId;
    providerName: string;
    owner: string;
    place?: string;
  };
  // The same for an agent's own browser sign-in, which Connect and Settings each offer too: Go runs one at a time, whatever the agent.
  agentSignIn?: {
    agentName: string;
    owner: string;
    place: string;
    // The sign-in is confirmed and the agent restarts with it.
    restarting?: boolean;
  };
  // Read by the chat and by Settings: a prompt sent while it restarts would reach no engine.
  credentialRestart?: CredentialRestart;
  setSelectedAgent: (agentId: AgentId) => void;
  setAuth: (agentId: AgentId, auth: AuthStatus) => void;
  setJustConnected: (justConnected: boolean) => void;
  setSessionExpired: (sessionExpired: boolean) => void;
  setAuthResolved: (authResolved: boolean) => void;
  setLastValidatedAt: (lastValidatedAt: number | undefined) => void;
  setAgentDown: (agentDown?: AgentDown) => void;
  setPickers: (pickers: CachedPickers) => void;
  setSessionActionError: (sessionActionError?: SessionActionError) => void;
  setRuntimeInstalled: (agentId: AgentId, installed: boolean) => void;
  setProviderSignIn: (
    providerSignIn?: AiAssistantStore['providerSignIn'],
  ) => void;
  setAgentSignIn: (agentSignIn?: AiAssistantStore['agentSignIn']) => void;
  setCredentialRestart: (credentialRestart?: CredentialRestart) => void;
}

export const useAiAssistantStore = create<AiAssistantStore>((set) => ({
  selectedAgentId: undefined,
  auth: {},
  justConnected: false,
  sessionExpired: false,
  authResolved: false,
  lastValidatedAt: undefined,
  agentDown: undefined,
  pickers: undefined,
  sessionActionError: undefined,
  runtimeInstalled: {},
  providerSignIn: undefined,
  agentSignIn: undefined,
  credentialRestart: undefined,
  setSelectedAgent: (selectedAgentId): void => set({ selectedAgentId }),
  setAuth: (agentId, auth): void =>
    set((state) => ({ auth: { ...state.auth, [agentId]: auth } })),
  setJustConnected: (justConnected): void => set({ justConnected }),
  setSessionExpired: (sessionExpired): void => set({ sessionExpired }),
  setAuthResolved: (authResolved): void => set({ authResolved }),
  setLastValidatedAt: (lastValidatedAt): void => set({ lastValidatedAt }),
  setAgentDown: (agentDown): void => set({ agentDown }),
  setPickers: (pickers): void =>
    set((state) => ({
      pickers: { ...pickers, agentId: state.selectedAgentId },
    })),
  setSessionActionError: (sessionActionError): void =>
    set({ sessionActionError }),
  setRuntimeInstalled: (agentId, installed): void =>
    set((state) => ({
      runtimeInstalled: { ...state.runtimeInstalled, [agentId]: installed },
    })),
  setProviderSignIn: (providerSignIn): void => set({ providerSignIn }),
  setAgentSignIn: (agentSignIn): void => set({ agentSignIn }),
  setCredentialRestart: (credentialRestart): void => set({ credentialRestart }),
}));

// A stable reference, so a selector for an agent with no answer yet does not rerender the view.
const NOT_AUTHENTICATED: AuthStatus = { authenticated: false };

// The status of the agent in use; not authenticated until one is resolved, which is the connect screen.
export const currentAuth = (s: {
  selectedAgentId?: AgentId;
  auth: Partial<Record<AgentId, AuthStatus>>;
}): AuthStatus =>
  (s.selectedAgentId ? s.auth[s.selectedAgentId] : undefined) ??
  NOT_AUTHENTICATED;

// The agent in use stores a session as soon as it is created, so the chat creates one only for its first prompt.
export const opensSessionOnFirstPrompt = (s: {
  selectedAgentId?: AgentId;
}): boolean => Boolean(getAgent(s.selectedAgentId)?.persistsNewSession);
