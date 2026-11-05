import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AgentDescriptor,
  AgentProvider,
  AuthResult,
  cancelProviderSignIn,
  deleteProviderKey,
  listProviderCredentials,
  listProviders,
  onProviderSignIn,
  ProviderCredential,
  setProviderKey,
  signInProvider,
} from '../../../services';
import { useAiAssistantStore } from '../../../store';
import { openInSystemBrowser } from '../../../utils';
import { errorText } from '../utils/errorText';

// What a key change produced, for the caller to word: no copy lives in here.
export interface ProviderOutcome {
  kind:
    | 'added'
    | 'signedIn'
    | 'removed'
    | 'removedAll'
    // Refused: another form's sign-in is still running, and provider names it.
    | 'signInBusy'
    | 'error';
  provider: string;
  message?: string;
  // For an added key: whether the provider confirmed it, or nobody could be asked.
  verified?: boolean;
  // For a removal: the provider was signed in to, so removing it signed out.
  signedIn?: boolean;
  // For a refused sign-in: where the waiting one is, as its own form names that place.
  place?: string;
}

// How Go picks the CLI's own failure line, the one place a provider's refusal of the account can show.
const CLI_FAILURE = /\b(fail|failed|error)\b/i;

export interface ProviderCredentialsLogic {
  // The offered providers without a key yet, in the backend's order.
  available: AgentProvider[];
  // True from "Add provider" until a provider is added or the user cancels.
  adding: boolean;
  startAdding: VoidFunction;
  cancelAdding: VoidFunction;
  // Whether the list is open under the trigger.
  open: boolean;
  setOpen: (open: boolean) => void;
  // The providers that already have a key.
  configured: ProviderCredential[];
  // The engine's free models are always there: a fixed row, never removed.
  hasFreeModels: boolean;
  // True until the first load settles, so the list does not flash empty.
  loading: boolean;
  // No catalogue at all: the engine has never fetched it, so there is nothing to choose from yet.
  catalogueEmpty: boolean;
  selected?: AgentProvider;
  select: (provider: AgentProvider) => void;
  clearSelection: VoidFunction;
  apiKey: string;
  setApiKey: (value: string) => void;
  saving: boolean;
  error?: string;
  save: () => Promise<void>;
  remove: (providerId: string) => Promise<void>;
  removeAll: () => Promise<void>;
  removingAll: boolean;
  // For a provider that is signed in to: the code to enter on its site, while the sign-in waits for it.
  signInPrompt?: { url: string; code: string };
  // The provider confirmed the sign-in; App Lab is still storing it.
  signInConfirmed: boolean;
  signingIn: boolean;
  // The last sign-in failed with the CLI's own failure line after the provider showed its code.
  signInRefused: boolean;
  // A sign-in refused because another form's waits, kept for a form whose caller shows no outcome.
  refusedSignIn?: { provider: string; place?: string };
  // Signs in to the given provider, or to the selected one: select() has not re-rendered yet when both run in one click.
  signIn: (provider?: AgentProvider) => Promise<void>;
  cancelSignIn: VoidFunction;
}

export const useProviderCredentialsLogic = (
  agent: AgentDescriptor,
  // Called after the first key lands: the card can then treat the agent as connected.
  onFirstCredential?: () => void | Promise<void>,
  // The keys reach the engine at spawn, so a running agent needs a restart to see a change.
  onCredentialsChanged?: () => void | Promise<void>,
  // What happened, for the surface to word: given one, the inline line stops being used.
  onOutcome?: (outcome: ProviderOutcome) => void,
  // True while a turn streams: a disabled button was not enough, Enter in the field called save().
  blocked?: boolean,
  // Where this form is, named to the other form when that one has to refuse a second sign-in.
  place?: string,
  // Failures stay on the form's own line, next to the field they are about; onOutcome hears the rest.
  inlineErrors?: boolean,
): ProviderCredentialsLogic => {
  // This form in the shared sign-in slot.
  const owner = useId();
  const removingAllRef = useRef(false);
  // A cancelled sign-in ends in an error from the engine, which is not news to the user who cancelled it.
  const signInCancelledRef = useRef(false);
  const signingInRef = useRef(false);
  // Set once the provider shows its code: a failure after that is the provider's answer.
  const codeShownRef = useRef(false);

  const [catalogue, setCatalogue] = useState<AgentProvider[]>([]);
  const [configured, setConfigured] = useState<ProviderCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentProvider>();
  const [apiKey, setApiKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [removingAll, setRemovingAll] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInConfirmed, setSignInConfirmed] = useState(false);
  const [signInRefused, setSignInRefused] = useState(false);
  const [refusedSignIn, setRefusedSignIn] =
    useState<ProviderCredentialsLogic['refusedSignIn']>();
  const [signInPrompt, setSignInPrompt] = useState<{
    url: string;
    code: string;
  }>();
  signingInRef.current = signingIn;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const releaseSignInSlot = useCallback((): void => {
    const { providerSignIn, setProviderSignIn } =
      useAiAssistantStore.getState();
    if (providerSignIn?.owner === owner) {
      setProviderSignIn(undefined);
    }
  }, [owner]);

  // A closed panel must not leave the login running: finishing later would restart the engine, maybe mid-turn.
  useEffect(
    () => () => {
      if (signingInRef.current) {
        signInCancelledRef.current = true;
        void cancelProviderSignIn(agent.id).catch(() => undefined);
      }
      releaseSignInSlot();
    },
    [agent.id, releaseSignInSlot],
  );

  // Another form's sign-in can land the provider this one shows, so its end re-reads the list.
  const othersSignIn = useAiAssistantStore((s) =>
    s.providerSignIn?.agentId === agent.id && s.providerSignIn.owner !== owner
      ? s.providerSignIn
      : undefined,
  );
  const watchedSignIn = useRef(othersSignIn);
  useEffect(() => {
    const ended = watchedSignIn.current !== undefined && !othersSignIn;
    watchedSignIn.current = othersSignIn;
    if (!ended) {
      return;
    }
    // The sign-in a refusal named is over, landed or not.
    setRefusedSignIn(undefined);
    let active = true;
    void listProviderCredentials(agent.id)
      .then((mine) => {
        if (!active) {
          return;
        }
        setConfigured(mine);
        const shown = selectedRef.current;
        if (shown && mine.some((c) => c.providerId === shown.id)) {
          setSelected(undefined);
          setOpen(false);
          setAdding(false);
        }
      })
      .catch(() => undefined);
    return (): void => {
      active = false;
    };
  }, [agent.id, othersSignIn]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listProviders(agent.id),
      listProviderCredentials(agent.id),
    ])
      .then(([all, mine]) => {
        if (active) {
          setCatalogue(all);
          setConfigured(mine);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return (): void => {
      active = false;
    };
  }, [agent.id]);

  const available = useMemo(
    () =>
      catalogue.filter((p) => !configured.some((c) => c.providerId === p.id)),
    [catalogue, configured],
  );

  const select = useCallback(
    (provider: AgentProvider): void => {
      // A key typed for one provider must never be sent to the next one picked.
      if (provider.id !== selected?.id) {
        setApiKeyValue('');
      }
      setSelected(provider);
      setOpen(false);
      setError(undefined);
      setSignInRefused(false);
      setRefusedSignIn(undefined);
    },
    [selected?.id],
  );

  const clearSelection = useCallback((): void => {
    setSelected(undefined);
    setApiKeyValue('');
    setError(undefined);
    setSignInRefused(false);
    setRefusedSignIn(undefined);
  }, []);

  const startAdding = useCallback((): void => {
    setAdding(true);
    setOpen(true);
    setError(undefined);
    setRefusedSignIn(undefined);
    // The catalogue can land after this panel mounted: the engine writes it on install or on its first start.
    if (catalogue.length === 0) {
      setLoading(true);
      void listProviders(agent.id)
        .then(setCatalogue)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  }, [agent.id, catalogue.length]);

  const cancelAdding = useCallback((): void => {
    if (signingInRef.current) {
      signInCancelledRef.current = true;
      void cancelProviderSignIn(agent.id).catch(() => undefined);
    }
    setAdding(false);
    setOpen(false);
    clearSelection();
  }, [agent.id, clearSelection]);

  // Falls back to the inline line when the caller offers nowhere else to put it, or wants failures kept there.
  const report = useCallback(
    (outcome: ProviderOutcome): void => {
      const failure = outcome.kind === 'error' || outcome.kind === 'signInBusy';
      if (onOutcome && !(inlineErrors && failure)) {
        onOutcome(outcome);
        return;
      }
      if (outcome.kind === 'error') {
        setError(outcome.message ?? '');
      }
      if (outcome.kind === 'signInBusy') {
        setRefusedSignIn({ provider: outcome.provider, place: outcome.place });
      }
    },
    [inlineErrors, onOutcome],
  );

  const setApiKey = useCallback((value: string): void => {
    setApiKeyValue(value);
    setError(undefined);
  }, []);

  const save = useCallback(async (): Promise<void> => {
    if (
      blocked ||
      removingAllRef.current ||
      !selected ||
      apiKey.trim() === ''
    ) {
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const result = await setProviderKey(agent.id, selected.id, apiKey.trim());
      if (!result.ok) {
        report({
          kind: 'error',
          provider: selected.name,
          message: result.error,
        });
        return;
      }
      const mine = await listProviderCredentials(agent.id);
      setConfigured(mine);
      setSelected(undefined);
      setApiKeyValue('');
      setOpen(false);
      setAdding(false);
      report({
        kind: 'added',
        provider: selected.name,
        verified: result.verified === true,
      });
      // Every key needs a restart to be seen; doing it only from the second left one provider unread.
      await onCredentialsChanged?.();
      // And the first one is also what turns the agent from unconfigured into usable.
      if (mine.length === 1) {
        await onFirstCredential?.();
      }
    } catch (e) {
      report({
        kind: 'error',
        provider: selected.name,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }, [
    agent.id,
    apiKey,
    blocked,
    onCredentialsChanged,
    onFirstCredential,
    report,
    selected,
  ]);

  const remove = useCallback(
    async (providerId: string): Promise<void> => {
      if (blocked || removingAllRef.current) {
        return;
      }
      setError(undefined);
      const removed = configured.find((c) => c.providerId === providerId);
      const name = removed?.name ?? providerId;
      try {
        await deleteProviderKey(agent.id, providerId);
        setConfigured(await listProviderCredentials(agent.id));
        // Else the running engine keeps offering the models of a provider whose key is gone.
        await onCredentialsChanged?.();
        report({
          kind: 'removed',
          provider: name,
          signedIn: removed?.signedIn,
        });
      } catch (e) {
        report({
          kind: 'error',
          provider: name,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [agent.id, blocked, configured, onCredentialsChanged, report],
  );

  // One respawn for all of them: remove() per key would restart the engine once per provider.
  const removeAll = useCallback(async (): Promise<void> => {
    if (
      blocked ||
      saving ||
      removingAllRef.current ||
      configured.length === 0
    ) {
      return;
    }
    removingAllRef.current = true;
    setRemovingAll(true);
    setError(undefined);
    const failed: ProviderCredential[] = [];
    // Each error with the providers it hit, so one cause shared by all of them is said once.
    const errors = new Map<string, string[]>();
    try {
      for (const c of configured) {
        try {
          await deleteProviderKey(agent.id, c.providerId);
        } catch (e) {
          failed.push(c);
          const message = errorText(e);
          errors.set(message, [...(errors.get(message) ?? []), c.name]);
        }
      }
      // A list that fails to reload must not skip the restart; what this run removed is known anyway.
      await listProviderCredentials(agent.id).then(setConfigured, () =>
        setConfigured(failed),
      );
      if (failed.length < configured.length) {
        await onCredentialsChanged?.();
      }
    } catch (e) {
      report({
        kind: 'error',
        provider: '',
        message: e instanceof Error ? e.message : String(e),
      });
      return;
    } finally {
      removingAllRef.current = false;
      setRemovingAll(false);
    }
    report(
      failed.length === 0
        ? { kind: 'removedAll', provider: '' }
        : {
            kind: 'error',
            provider: failed.map((c) => c.name).join(', '),
            // The toast shows the message alone, and an error rarely names its provider.
            message: Array.from(
              errors,
              ([error, names]) => `${names.join(', ')}: ${error}`,
            ).join('; '),
          },
    );
  }, [agent.id, blocked, configured, onCredentialsChanged, report, saving]);

  // Not news to the user: they cancelled it, or another form holds the engine's login now.
  const signInSuperseded = useCallback(
    (): boolean =>
      signInCancelledRef.current ||
      useAiAssistantStore.getState().providerSignIn?.owner !== owner,
    [owner],
  );

  const signIn = useCallback(
    async (target?: AgentProvider): Promise<void> => {
      const provider = target ?? selected;
      if (blocked || removingAllRef.current || !provider?.signIn || signingIn) {
        return;
      }
      const { providerSignIn: running, setProviderSignIn } =
        useAiAssistantStore.getState();
      // Go runs one engine login at a time, and starting another would cancel the one waiting in the other form.
      if (running?.agentId === agent.id && running.owner !== owner) {
        report({
          kind: 'signInBusy',
          provider: running.providerName,
          place: running.place,
        });
        return;
      }
      setProviderSignIn({
        agentId: agent.id,
        providerName: provider.name,
        owner,
        place,
      });
      signInCancelledRef.current = false;
      codeShownRef.current = false;
      setSigningIn(true);
      setSignInRefused(false);
      setRefusedSignIn(undefined);
      setError(undefined);
      // The same steps for a sign-in that succeeded and for one that errored but landed all the same.
      const landed = async (mine: ProviderCredential[]): Promise<void> => {
        setConfigured(mine);
        setSelected(undefined);
        setApiKeyValue('');
        setOpen(false);
        setAdding(false);
        report({ kind: 'signedIn', provider: provider.name });
        await onCredentialsChanged?.();
        if (mine.length === 1) {
          await onFirstCredential?.();
        }
      };
      const stopListening = onProviderSignIn((prompt) => {
        if (prompt.providerId !== provider.id) {
          return;
        }
        codeShownRef.current = true;
        setSignInPrompt({ url: prompt.url, code: prompt.code });
        if (!openInSystemBrowser(prompt.url)) {
          window.open(prompt.url, '_blank', 'noopener,noreferrer');
        }
      });
      try {
        const result = await signInProvider(agent.id, provider.id).catch(
          (e: unknown): AuthResult => ({ ok: false, error: errorText(e) }),
        );
        if (!result.ok) {
          if (signInSuperseded()) {
            return;
          }
          // A login that errors can still have landed, and an error shown beside a signed-in provider is wrong.
          const mine = await listProviderCredentials(agent.id).catch(
            () => undefined,
          );
          if (mine?.some((c) => c.providerId === provider.id)) {
            await landed(mine);
            return;
          }
          if (mine) {
            setConfigured(mine);
          }
          setSignInRefused(
            codeShownRef.current && CLI_FAILURE.test(result.error ?? ''),
          );
          report({
            kind: 'error',
            provider: provider.name,
            message: result.error,
          });
          return;
        }
        setSignInConfirmed(true);
        await landed(await listProviderCredentials(agent.id));
      } catch (e) {
        report({
          kind: 'error',
          provider: provider.name,
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        stopListening();
        releaseSignInSlot();
        setSigningIn(false);
        setSignInConfirmed(false);
        setSignInPrompt(undefined);
      }
    },
    [
      agent.id,
      blocked,
      onCredentialsChanged,
      onFirstCredential,
      owner,
      place,
      releaseSignInSlot,
      report,
      selected,
      signInSuperseded,
      signingIn,
    ],
  );

  const cancelSignIn = useCallback((): void => {
    signInCancelledRef.current = true;
    void cancelProviderSignIn(agent.id).catch(() => undefined);
  }, [agent.id]);

  return {
    available,
    adding,
    startAdding,
    cancelAdding,
    open,
    setOpen,
    configured,
    hasFreeModels: Boolean(agent.usableWithoutKey),
    loading,
    catalogueEmpty: !loading && catalogue.length === 0,
    selected,
    select,
    clearSelection,
    apiKey,
    setApiKey,
    saving,
    error,
    save,
    remove,
    removeAll,
    removingAll,
    signInPrompt,
    signInConfirmed,
    signingIn,
    signInRefused,
    refusedSignIn,
    signIn,
    cancelSignIn,
  };
};
