import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { messages } from '../../../messages';
import {
  AgentDescriptor,
  AgentId,
  authenticate,
  authenticateApiKey,
  AuthMethod,
  cancelLogin,
  onLoginUrl,
  submitLoginToken,
} from '../../../services';
import { useAiAssistantStore } from '../../../store';

export type AuthTab = 'signin' | 'apikey';

// An agent with no browser sign-in must not show that tab: Go refuses, so the button could only error.
const authTabsOf = (agent?: AgentDescriptor): AuthTab[] => {
  const methods: AuthMethod[] = agent?.authMethods ?? [
    'subscription',
    'api_key',
  ];
  const tabs = methods.map(
    (m): AuthTab => (m === 'subscription' ? 'signin' : 'apikey'),
  );
  return tabs.length > 0 ? tabs : ['apikey'];
};

interface UseAgentAuthFlowOptions {
  // The agent being authenticated. Handlers no-op while undefined.
  agent?: AgentDescriptor;
  // Called after a successful sign-in / API-key verification.
  onAuthenticated: (agentId: AgentId) => void | Promise<void>;
  // Called with a user-facing message when auth fails (surfaced by the consumer).
  onError?: (message: string) => void;
  // Where this flow is shown, named to the other surface while this one's sign-in waits.
  place: string;
}

// The reusable auth surface's state + handlers, shared by the connect panel and
// the Settings "Agent" section so both show the identical Sign in / API Key flow.
export interface AgentAuthFlowState {
  // The tabs this agent has; one means the switcher is not rendered at all.
  authTabs: AuthTab[];
  authTab: AuthTab;
  setAuthTab: (tab: AuthTab) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  // True once Verify ran against a wrongly-formatted key (cleared on edit).
  apiKeyError: boolean;
  signingIn: boolean;
  // Sign-in URL shown while waiting for confirmation; undefined when idle.
  authUrl?: string;
  verifying: boolean;
  // True once "Paste token" was clicked: the waiting screen swaps its hint row
  // for the token field.
  tokenEntry: boolean;
  showTokenEntry: VoidFunction;
  loginToken: string;
  setLoginToken: (value: string) => void;
  // True once a submitted token was rejected (cleared on edit / on a new sign-in).
  tokenError: boolean;
  // True while a submitted token is being checked (until the sign-in settles).
  verifyingToken: boolean;
  signIn: () => Promise<void>;
  // Verifies `token` (the pasted value, which also becomes the field's) or, with
  // no argument, whatever is in the field.
  submitToken: (token?: string) => Promise<void>;
  verifyApiKey: () => Promise<void>;
  // The first provider key just landed: same step verifyApiKey takes, for an agent with no single key.
  credentialAdded: () => Promise<void>;
  // Abort any in-flight sign-in and clear the fields (call on cancel/close).
  reset: VoidFunction;
}

const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const useAgentAuthFlow = ({
  agent,
  onAuthenticated,
  onError,
  place,
}: UseAgentAuthFlowOptions): AgentAuthFlowState => {
  const { formatMessage } = useI18n();
  // This flow in the shared sign-in slot.
  const owner = useId();
  const authTabs = useMemo(() => authTabsOf(agent), [agent]);
  // Undefined until the user picks one: each agent then opens on its own first tab.
  const [selectedTab, setAuthTab] = useState<AuthTab>();
  // Derived: the agent can change under a mounted flow, and leave behind a tab the new one lacks.
  const authTab =
    selectedTab && authTabs.includes(selectedTab) ? selectedTab : authTabs[0];
  const [apiKey, setApiKeyValue] = useState('');
  const [apiKeyError, setApiKeyError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [tokenEntry, setTokenEntry] = useState(false);
  const [loginToken, setLoginTokenValue] = useState('');
  const [tokenError, setTokenError] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);

  // Set when the user cancels while a browser sign-in is still pending, so its
  // (backend-driven) result is ignored instead of forcing the user through.
  const signInCancelledRef = useRef(false);
  // Bumped per attempt: a superseded sign-in settles late and must not touch the current one.
  const signInGenRef = useRef(0);
  // Set while a pasted token is with the backend, so the sign-in's own failure
  // surfaces inline on the token field instead of as a generic error.
  const tokenSubmittedRef = useRef(false);
  const signingInRef = useRef(false);
  signingInRef.current = signingIn;
  // Set before the first await: a second Enter in the key field lands before `verifying` re-renders.
  const verifyingRef = useRef(false);

  const releaseSignInSlot = useCallback((): void => {
    const { agentSignIn, setAgentSignIn } = useAiAssistantStore.getState();
    if (agentSignIn?.owner === owner) {
      setAgentSignIn(undefined);
    }
  }, [owner]);

  // A closed surface must not leave its login running, nor keep the other one refused.
  const agentId = agent?.id;
  useEffect(
    () => () => {
      if (agentId && signingInRef.current) {
        signInCancelledRef.current = true;
        void cancelLogin(agentId);
      }
      releaseSignInSlot();
    },
    [agentId, releaseSignInSlot],
  );

  const clearTokenEntry = useCallback((): void => {
    tokenSubmittedRef.current = false;
    setTokenEntry(false);
    setLoginTokenValue('');
    setTokenError(false);
    setVerifyingToken(false);
  }, []);

  const reset = useCallback((): void => {
    // Only a login this flow started: Go cancels the agent's login wherever it runs, the hidden Connect panel's too.
    if (agent && signingInRef.current) {
      void cancelLogin(agent.id); // tell Go too, or the login CLI keeps running until the app quits
    }
    signInCancelledRef.current = true;
    releaseSignInSlot();
    setSigningIn(false);
    setAuthUrl(undefined);
    setApiKeyValue('');
    setApiKeyError(false);
    setAuthTab(undefined);
    clearTokenEntry();
  }, [agent, clearTokenEntry, releaseSignInSlot]);

  const setApiKey = useCallback((value: string): void => {
    setApiKeyValue(value);
    setApiKeyError(false);
  }, []);

  const signIn = useCallback(async (): Promise<void> => {
    if (!agent) {
      return;
    }
    const { agentSignIn: running, setAgentSignIn } =
      useAiAssistantStore.getState();
    // Go runs one browser sign-in for the whole app, so another start, for any agent, would cancel the one the other surface waits on.
    if (running && running.owner !== owner) {
      onError?.(
        formatMessage(
          running.restarting
            ? messages.agentSignInRestarting
            : messages.agentSignInBusy,
          { agent: running.agentName, place: running.place },
        ),
      );
      return;
    }
    const slot = { agentName: agent.name, owner, place };
    setAgentSignIn(slot);
    signInCancelledRef.current = false;
    const generation = ++signInGenRef.current;
    const stale = (): boolean =>
      signInCancelledRef.current || signInGenRef.current !== generation;
    clearTokenEntry();
    setSigningIn(true);
    setAuthUrl(undefined);
    // The agent CLI prints its OAuth URL; surface it as the copyable link.
    const unsubscribe = onLoginUrl((url) => {
      if (!stale()) {
        setAuthUrl(url);
      }
    });
    try {
      const result = await authenticate(agent.id);
      // The user cancelled while the browser flow was pending: ignore the result.
      if (stale()) {
        return;
      }
      if (!result.ok) {
        // A sign-in the user completed by pasting a token failed *because of*
        // that token, so report it on the field rather than as a toast.
        if (tokenSubmittedRef.current) {
          setTokenError(true);
        } else {
          onError?.(result.error ?? '');
        }
        return;
      }
      // The token is accepted from here on: a later failure must not read as a bad token.
      tokenSubmittedRef.current = false;
      // The slot stays held while the agent restarts with the new sign-in.
      setAgentSignIn({ ...slot, restarting: true });
      await onAuthenticated(agent.id);
    } catch (e) {
      if (!stale()) {
        if (tokenSubmittedRef.current) {
          setTokenError(true);
        } else {
          onError?.(errorText(e));
        }
      }
    } finally {
      unsubscribe();
      // A newer attempt of this flow holds the slot under the same owner.
      if (signInGenRef.current === generation) {
        releaseSignInSlot();
      }
      if (!stale()) {
        setSigningIn(false);
        setAuthUrl(undefined);
        // The login process is gone either way: drop the field (keeping any
        // error) so a retry starts a fresh browser flow.
        tokenSubmittedRef.current = false;
        setTokenEntry(false);
        setLoginTokenValue('');
        setVerifyingToken(false);
      }
    }
  }, [
    agent,
    clearTokenEntry,
    formatMessage,
    onAuthenticated,
    onError,
    owner,
    place,
    releaseSignInSlot,
  ]);

  const showTokenEntry = useCallback((): void => {
    setTokenError(false);
    setTokenEntry(true);
  }, []);

  const setLoginToken = useCallback((value: string): void => {
    setLoginTokenValue(value);
    setTokenError(false);
  }, []);

  // Hands the pasted token to the sign-in still running from signIn(): that call
  // is what reports the outcome, so this only clears "verifying" when the token
  // couldn't be delivered at all. Verification starts on paste, so the value
  // comes in as an argument (the field's state hasn't caught up yet).
  const submitToken = useCallback(
    async (pasted?: string): Promise<void> => {
      const token = (pasted ?? loginToken).trim();
      if (!agent || token === '' || verifyingToken) {
        return;
      }
      if (pasted !== undefined) {
        setLoginTokenValue(token);
      }
      setTokenError(false);
      setVerifyingToken(true);
      tokenSubmittedRef.current = true;
      try {
        await submitLoginToken(agent.id, token);
      } catch {
        tokenSubmittedRef.current = false;
        setVerifyingToken(false);
        setTokenError(true);
      }
    },
    [agent, loginToken, verifyingToken],
  );

  const credentialAdded = useCallback(async (): Promise<void> => {
    if (agent) {
      await onAuthenticated(agent.id);
    }
  }, [agent, onAuthenticated]);

  const verifyApiKey = useCallback(async (): Promise<void> => {
    if (!agent || verifyingRef.current) {
      return;
    }
    const key = apiKey.trim();
    if (!key.startsWith(agent.apiKeyPrefix)) {
      setApiKeyError(true);
      return;
    }
    verifyingRef.current = true;
    setVerifying(true);
    try {
      const result = await authenticateApiKey(agent.id, key);
      if (!result.ok) {
        onError?.(result.error ?? '');
        return;
      }
      await onAuthenticated(agent.id);
    } catch (e) {
      onError?.(errorText(e));
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, [agent, apiKey, onAuthenticated, onError]);

  return {
    authTabs,
    authTab,
    setAuthTab,
    apiKey,
    setApiKey,
    apiKeyError,
    signingIn,
    authUrl,
    verifying,
    tokenEntry,
    showTokenEntry,
    loginToken,
    setLoginToken,
    tokenError,
    verifyingToken,
    signIn,
    submitToken,
    verifyApiKey,
    credentialAdded,
    reset,
  };
};
