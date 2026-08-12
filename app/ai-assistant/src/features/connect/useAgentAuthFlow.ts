import { useCallback, useRef, useState } from 'react';

import {
  AgentDescriptor,
  AgentId,
  authenticate,
  authenticateApiKey,
  cancelLogin,
  onLoginUrl,
  submitLoginToken,
} from '../../services';

export type AuthTab = 'signin' | 'apikey';

interface UseAgentAuthFlowOptions {
  // The agent being authenticated. Handlers no-op while undefined.
  agent?: AgentDescriptor;
  // Called after a successful sign-in / API-key verification.
  onAuthenticated: (agentId: AgentId) => void | Promise<void>;
  // Called with a user-facing message when auth fails (surfaced by the consumer).
  onError?: (message: string) => void;
}

// The reusable auth surface's state + handlers, shared by the connect panel and
// the Settings "Agent" section so both show the identical Sign in / API Key flow.
export interface AgentAuthFlowState {
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
  // Abort any in-flight sign-in and clear the fields (call on cancel/close).
  reset: VoidFunction;
}

const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const useAgentAuthFlow = ({
  agent,
  onAuthenticated,
  onError,
}: UseAgentAuthFlowOptions): AgentAuthFlowState => {
  const [authTab, setAuthTab] = useState<AuthTab>('signin');
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

  const clearTokenEntry = useCallback((): void => {
    tokenSubmittedRef.current = false;
    setTokenEntry(false);
    setLoginTokenValue('');
    setTokenError(false);
    setVerifyingToken(false);
  }, []);

  const reset = useCallback((): void => {
    signInCancelledRef.current = true;
    if (agent) {
      void cancelLogin(agent.id); // tell Go too, or the login CLI keeps running until the app quits
    }
    setSigningIn(false);
    setAuthUrl(undefined);
    setApiKeyValue('');
    setApiKeyError(false);
    setAuthTab('signin');
    clearTokenEntry();
  }, [agent, clearTokenEntry]);

  const setApiKey = useCallback((value: string): void => {
    setApiKeyValue(value);
    setApiKeyError(false);
  }, []);

  const signIn = useCallback(async (): Promise<void> => {
    if (!agent) {
      return;
    }
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
  }, [agent, clearTokenEntry, onAuthenticated, onError]);

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

  const verifyApiKey = useCallback(async (): Promise<void> => {
    if (!agent) {
      return;
    }
    const key = apiKey.trim();
    if (!key.startsWith(agent.apiKeyPrefix)) {
      setApiKeyError(true);
      return;
    }
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
      setVerifying(false);
    }
  }, [agent, apiKey, onAuthenticated, onError]);

  return {
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
    reset,
  };
};
