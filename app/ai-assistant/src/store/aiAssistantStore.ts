import { create } from 'zustand';

import { AgentId, AgentMode, AgentModel, AuthStatus } from '../services';

// Last models/modes advertised by a session, cached so re-opening the chat can render the pickers
// immediately (from cache) instead of leaving the toolbar empty until getSessionState resolves.
export interface CachedPickers {
  models: AgentModel[];
  currentModelId?: string;
  modes: AgentMode[];
  currentModeId?: string;
}

// A session mutation the backend rejected, reported by the chat's toast area (the side panel has no
// layer of its own).
export type SessionActionError = 'rename' | 'pin' | 'delete';

interface AiAssistantStore {
  selectedAgentId?: AgentId;
  auth: AuthStatus;
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
  // The agent process crashed and Go ran out of restart attempts, so every call now fails. The panel
  // shows a reconnect affordance instead of the chat — without it agent mode stays dead (and reads as
  // a fresh install) until the app restarts.
  agentDown: boolean;
  // Why it is down, so the prompt can explain itself: a crash, or the board it was bound to changing.
  agentDownReason?: 'crashed' | 'board-changed';
  // Cached picker options from the most recent session, to avoid an empty toolbar (and layout shift)
  // while a freshly opened chat waits for its session state.
  pickers?: CachedPickers;
  // Set by the side panel when a rename/pin/delete is rejected; the chat shows it and clears it.
  sessionActionError?: SessionActionError;
  setSelectedAgent: (agentId: AgentId) => void;
  setAuth: (auth: AuthStatus) => void;
  setJustConnected: (justConnected: boolean) => void;
  setSessionExpired: (sessionExpired: boolean) => void;
  setAuthResolved: (authResolved: boolean) => void;
  setLastValidatedAt: (lastValidatedAt: number | undefined) => void;
  setAgentDown: (
    agentDown: boolean,
    reason?: 'crashed' | 'board-changed',
  ) => void;
  setPickers: (pickers: CachedPickers) => void;
  setSessionActionError: (sessionActionError?: SessionActionError) => void;
}

export const useAiAssistantStore = create<AiAssistantStore>((set) => ({
  selectedAgentId: undefined,
  auth: { authenticated: false },
  justConnected: false,
  sessionExpired: false,
  authResolved: false,
  lastValidatedAt: undefined,
  agentDown: false,
  pickers: undefined,
  sessionActionError: undefined,
  setSelectedAgent: (selectedAgentId): void => set({ selectedAgentId }),
  setAuth: (auth): void => set({ auth }),
  setJustConnected: (justConnected): void => set({ justConnected }),
  setSessionExpired: (sessionExpired): void => set({ sessionExpired }),
  setAuthResolved: (authResolved): void => set({ authResolved }),
  setLastValidatedAt: (lastValidatedAt): void => set({ lastValidatedAt }),
  setAgentDown: (agentDown, agentDownReason): void =>
    set({ agentDown, agentDownReason }),
  setPickers: (pickers): void => set({ pickers }),
  setSessionActionError: (sessionActionError): void =>
    set({ sessionActionError }),
}));
