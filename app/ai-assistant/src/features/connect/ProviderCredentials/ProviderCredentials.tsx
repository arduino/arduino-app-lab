import {
  Bin,
  Checkmark,
  ChevronDown,
  CloseX,
  StatusError,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  Text,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { type MessageDescriptor } from 'react-intl';

import { messages, providerSignInBrands } from '../../../messages';
import { type AgentDescriptor, type AgentProvider } from '../../../services';
import {
  type PickerOptionContent,
  Blocked,
  ConfirmDialog,
  Picker,
} from '../../../ui';
import { openInSystemBrowser } from '../../../utils';
import { ApiKeyField } from '../ApiKeyField/ApiKeyField';
import { describeError } from '../utils/describeError';
import { CopyField } from './CopyField';
import styles from './provider-credentials.module.scss';
import {
  type ProviderOutcome,
  useProviderCredentialsLogic,
} from './ProviderCredentials.logic';
import { ProviderLogo } from './ProviderLogo';
import { hostOf } from './utils/hostOf';

type ProviderCredentialsProps = {
  agent: AgentDescriptor;
  onFirstCredential?: () => void | Promise<void>;
  onCredentialsChanged?: () => void | Promise<void>;
  // Where the outcome is shown: the host's toast, so an accepted key is as visible as a refused one.
  onNotify?: (message: string, kind: 'error' | 'success') => void;
  // Failures stay on the form's own line, and only what went well goes to onNotify.
  inlineErrors?: boolean;
  // True while a key is checked, a sign-in waits or every key is being deleted: starting the agent then would miss it.
  onBusyChange?: (busy: boolean) => void;
  // Why a key cannot be added or removed right now; every change respawns the engine.
  blockedReason?: string;
  // Where this form is, named to the other form when that one has to refuse a second sign-in.
  place?: string;
  className?: string;
};

// A row that says more providers are coming, while the catalogue loads.
const LOADING_ID = 'app-lab:loading';

const brands: Partial<Record<string, MessageDescriptor>> = providerSignInBrands;

// One key per provider, as many as the user wants, from the catalogue the engine itself keeps.
export const ProviderCredentials: React.FC<ProviderCredentialsProps> = ({
  agent,
  onFirstCredential,
  onCredentialsChanged,
  onNotify,
  inlineErrors,
  onBusyChange,
  blockedReason,
  place,
  className,
}) => {
  const { formatMessage } = useI18n();
  const busyText = (refusal: { provider: string; place?: string }): string =>
    refusal.place
      ? formatMessage(messages.providerSignInBusy, {
          provider: refusal.provider,
          place: refusal.place,
        })
      : formatMessage(messages.providerSignInBusyElsewhere, {
          provider: refusal.provider,
        });
  const say = (outcome: ProviderOutcome): void => {
    if (!onNotify) {
      return;
    }
    // Whole: the host words a coded error where it shows it.
    if (outcome.kind === 'error') {
      onNotify(outcome.message ?? '', 'error');
      return;
    }
    if (outcome.kind === 'signInBusy') {
      onNotify(busyText(outcome), 'error');
      return;
    }
    const message =
      outcome.kind === 'signedIn'
        ? messages.providerSignedInToast
        : outcome.kind === 'removedAll'
        ? messages.providerKeysRemovedAll
        : outcome.kind === 'removed' && outcome.signedIn
        ? messages.providerSignedOut
        : outcome.kind === 'removed'
        ? messages.providerKeyRemoved
        : outcome.verified
        ? messages.providerKeyAdded
        : messages.providerKeyUnchecked;
    onNotify(formatMessage(message, { provider: outcome.provider }), 'success');
  };
  const logic = useProviderCredentialsLogic(
    agent,
    onFirstCredential,
    onCredentialsChanged,
    onNotify ? say : undefined,
    Boolean(blockedReason),
    place,
    inlineErrors,
  );
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const signInRef = useRef<HTMLButtonElement>(null);
  const wasAdding = useRef(logic.adding);
  const wasSigningIn = useRef(logic.signingIn);
  const prompt = logic.signInPrompt;
  const selected = logic.selected;
  const blocked = Boolean(blockedReason);
  const freeModelsName = formatMessage(messages.providerFreeModels, {
    agent: agent.name,
  });
  const loadingItem: AgentProvider = {
    id: LOADING_ID,
    name: formatMessage(messages.providerListLoading),
    envVar: '',
  };
  const pickerItems = [
    ...logic.available,
    ...(logic.loading ? [loadingItem] : []),
  ];

  // The account a sign-in provider is signed in with, where App Lab names it; else the provider's own name.
  const brandOf = (p: AgentProvider): string => {
    const brand = brands[p.id];
    return brand ? formatMessage(brand) : p.name;
  };

  const methodOf = (p: AgentProvider): string =>
    p.signIn
      ? formatMessage(messages.providerMethodSignIn, { provider: brandOf(p) })
      : formatMessage(
          p.freeKey
            ? messages.providerMethodFreeKey
            : messages.providerMethodKey,
        );

  // Closing the list with nothing picked is backing out of adding one.
  const closeList = (): void => {
    if (selected) {
      logic.setOpen(false);
      return;
    }
    logic.cancelAdding();
  };

  const choose = (p: AgentProvider): void => {
    if (p.id === LOADING_ID) {
      return;
    }
    logic.select(p);
    if (p.signIn) {
      void logic.signIn(p);
    }
  };

  const busy = logic.saving || logic.signingIn || logic.removingAll;
  const keyForm = Boolean(selected && !selected.signIn);
  const cancelButton = (
    <Button
      ref={backRef}
      variant={ButtonVariant.Tertiary}
      appearance={ButtonAppearance.LowContrast}
      size={keyForm ? ButtonSize.Small : ButtonSize.XSmall}
      // The check runs on: cancelling now would hide a key that still lands.
      disabled={logic.saving}
      onClick={logic.cancelAdding}
    >
      {formatMessage(messages.providerCancel)}
    </Button>
  );
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Into the form when it opens and back to its button when it closes: else keyboard focus drops to the page.
  useEffect(() => {
    if (logic.adding) {
      (triggerRef.current ?? backRef.current)?.focus();
    } else if (wasAdding.current) {
      addRef.current?.focus();
    }
    wasAdding.current = logic.adding;
  }, [logic.adding]);

  // The chooser goes while a sign-in waits, and the focus with it: on Cancel meanwhile, on its retry button once it fails.
  useEffect(() => {
    if (logic.signingIn) {
      backRef.current?.focus();
    } else if (wasSigningIn.current) {
      (signInRef.current ?? addRef.current)?.focus();
    }
    wasSigningIn.current = logic.signingIn;
  }, [logic.signingIn]);

  return (
    <div className={clsx(styles['providers'], className)}>
      <div className={styles['head']}>
        <div className={styles['header']}>
          <span className={styles['title']}>
            {formatMessage(messages.providersTitle)}
          </span>
          {logic.configured.length > 0 && (
            <span className={styles['summary']}>
              {formatMessage(messages.providersConnectedCount, {
                count: logic.configured.length,
              })}
            </span>
          )}
        </div>
        <Text size={TextSize.XXSmall} className={styles['subtle']}>
          {formatMessage(messages.providersSubtitle)}
        </Text>
      </div>

      {!logic.adding && (
        <>
          {(logic.configured.length > 0 || logic.hasFreeModels) && (
            <ul className={styles['configured']}>
              {logic.hasFreeModels && (
                <li className={styles['configured-row']}>
                  <span className={styles['configured-left']}>
                    <ProviderLogo providerId={agent.id} small />
                    <span className={styles['configured-name']}>
                      {freeModelsName}
                    </span>
                  </span>
                  <span className={styles['configured-right']}>
                    <span className={styles['configured-key']}>
                      {formatMessage(messages.providerFreeModelsNoKey)}
                    </span>
                  </span>
                </li>
              )}
              {logic.configured.map((c) => (
                <li key={c.providerId} className={styles['configured-row']}>
                  <span className={styles['configured-left']}>
                    <ProviderLogo providerId={c.providerId} small />
                    <span className={styles['configured-name']}>{c.name}</span>
                  </span>
                  <span className={styles['configured-right']}>
                    <span className={styles['configured-key']}>
                      {c.signedIn
                        ? formatMessage(messages.providerSignedIn)
                        : c.maskedKey}
                    </span>
                    <Blocked reason={blockedReason}>
                      <button
                        type="button"
                        className={styles['remove']}
                        disabled={
                          blocked || logic.removingAll || logic.signingIn
                        }
                        aria-label={formatMessage(messages.providerRemove, {
                          provider: c.name,
                        })}
                        onClick={(): void => {
                          void logic.remove(c.providerId);
                        }}
                      >
                        <CloseX aria-hidden="true" />
                      </button>
                    </Blocked>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className={styles['actions']}>
            <Blocked reason={blockedReason}>
              <Button
                ref={addRef}
                variant={ButtonVariant.Secondary}
                appearance={ButtonAppearance.LowContrast}
                size={ButtonSize.XSmall}
                disabled={blocked || logic.removingAll}
                onClick={logic.startAdding}
              >
                {formatMessage(messages.providerAddProvider)}
              </Button>
            </Blocked>
            {/* The free-models row counts as one: it stays, every key goes. */}
            {logic.configured.length + (logic.hasFreeModels ? 1 : 0) > 1 && (
              <Blocked reason={blockedReason}>
                <Button
                  variant={ButtonVariant.Tertiary}
                  appearance={ButtonAppearance.Destructive}
                  size={ButtonSize.XSmall}
                  loading={logic.removingAll}
                  disabled={blocked || logic.removingAll || logic.saving}
                  onClick={(): void => setConfirmingDeleteAll(true)}
                >
                  {formatMessage(messages.providerDeleteAll)}
                </Button>
              </Blocked>
            )}
          </div>
        </>
      )}

      {logic.adding && (
        // Catches Escape from any control inside; an open list closes first, through its own Escape.
        <div
          className={styles['adding']}
          role="presentation"
          onKeyDown={(e): void => {
            if (e.key === 'Escape' && !logic.open && !logic.saving) {
              logic.cancelAdding();
            }
          }}
        >
          {logic.catalogueEmpty ? (
            <Text size={TextSize.XXSmall} className={styles['subtle']}>
              {formatMessage(messages.providerCatalogueEmpty)}
            </Text>
          ) : (
            !(selected?.signIn && logic.signingIn) && (
              <div className={styles['chooser']}>
                <Picker
                  items={pickerItems}
                  isOpen={logic.open}
                  onSelect={(id): void => {
                    const provider = pickerItems.find((p) => p.id === id);
                    if (provider) {
                      choose(provider);
                    }
                  }}
                  onClose={closeList}
                  isSelected={(p): boolean => p.id === selected?.id}
                  getOption={(p): PickerOptionContent =>
                    p.id === LOADING_ID
                      ? {
                          label: p.name,
                          Icon: (
                            <span
                              className={styles['spinner']}
                              aria-hidden="true"
                            />
                          ),
                        }
                      : {
                          label: p.name,
                          Icon: <ProviderLogo providerId={p.id} />,
                          hint: methodOf(p),
                        }
                  }
                  align="left"
                  classes={{ menu: styles['menu'] }}
                  renderTrigger={(isOpen): React.ReactNode => (
                    <button
                      ref={triggerRef}
                      type="button"
                      className={styles['trigger']}
                      aria-haspopup="listbox"
                      aria-expanded={isOpen}
                      disabled={logic.saving}
                      // Closing it is the same as a click outside: with nothing picked, adding ends.
                      onClick={(): void =>
                        isOpen ? closeList() : logic.setOpen(true)
                      }
                    >
                      <span className={styles['trigger-body']}>
                        <span className={styles['field-label']}>
                          {formatMessage(messages.providerSearchLabel)}
                        </span>
                        <span
                          className={clsx(
                            styles['trigger-name'],
                            !selected && styles['trigger-name--placeholder'],
                          )}
                        >
                          {selected?.name ??
                            formatMessage(messages.providerChoosePlaceholder)}
                        </span>
                      </span>
                      <ChevronDown
                        className={styles['trigger-chevron']}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                />
              </div>
            )
          )}

          {selected?.signIn && (
            <div className={styles['sign-in']} aria-live="polite">
              {prompt ? (
                <>
                  <Text size={TextSize.XXSmall} className={styles['subtle']}>
                    <strong className={styles['strong']}>
                      {formatMessage(messages.providerSignInBrowser)}
                    </strong>{' '}
                    {formatMessage(messages.providerSignInBrowserNote)}
                  </Text>
                  <CopyField
                    value={prompt.url}
                    copyLabel={formatMessage(messages.providerCopySignInPage)}
                  />
                  <CopyField
                    value={prompt.code}
                    label={formatMessage(messages.providerSignInDeviceCode)}
                    copyLabel={formatMessage(messages.providerCopyDeviceCode)}
                  />
                  {logic.signInConfirmed ? (
                    <span className={styles['success']}>
                      <Checkmark
                        className={styles['status-icon']}
                        aria-hidden="true"
                      />
                      {formatMessage(messages.providerSignInConfirmed, {
                        provider: brandOf(selected),
                      })}
                    </span>
                  ) : (
                    <span className={styles['waiting']}>
                      <span className={styles['spinner']} aria-hidden="true" />
                      {formatMessage(messages.providerSignInWaitingOn, {
                        host: hostOf(prompt.url),
                      })}
                    </span>
                  )}
                </>
              ) : (
                !logic.signingIn && (
                  <>
                    {logic.signInRefused && (
                      <Text
                        size={TextSize.XXSmall}
                        className={styles['subtle']}
                      >
                        {formatMessage(messages.providerSignInHint, {
                          provider: selected.name,
                        })}
                      </Text>
                    )}
                    <Blocked reason={blockedReason}>
                      <Button
                        ref={signInRef}
                        variant={ButtonVariant.Primary}
                        size={ButtonSize.XSmall}
                        disabled={blocked || logic.removingAll}
                        onClick={(): void => {
                          void logic.signIn();
                        }}
                      >
                        {formatMessage(messages.providerSignIn, {
                          provider: selected.name,
                        })}
                      </Button>
                    </Blocked>
                  </>
                )
              )}
              {logic.signingIn && !prompt && (
                <span className={styles['waiting']}>
                  <span className={styles['spinner']} aria-hidden="true" />
                  {formatMessage(messages.providerSignInWaiting)}
                </span>
              )}
            </div>
          )}

          {selected && !selected.signIn && (
            <div className={styles['key']}>
              {logic.saving && (
                <Text size={TextSize.XXSmall} className={styles['subtle']}>
                  <strong className={styles['strong']}>
                    {formatMessage(messages.providerChecking, {
                      provider: selected.name,
                    })}
                  </strong>{' '}
                  {formatMessage(messages.providerCheckingNote)}
                </Text>
              )}
              <ApiKeyField
                // A key typed in the clear is readable over a shoulder, a screen share or a screenshot.
                masked
                autoFocus
                disabled={blocked || logic.saving}
                value={logic.apiKey}
                onChange={logic.setApiKey}
                onVerify={logic.save}
                placeholder={`${selected.keyPrefix ?? ''}…`}
                label={formatMessage(messages.providerKeyLabel)}
                ariaLabel={formatMessage(messages.providerKeyLabel)}
                verifyLabel={formatMessage(messages.providerVerify)}
                verifyDisabled={blocked || logic.removingAll}
                hideVerify={logic.saving}
                blockedReason={blockedReason}
                cancelButton={cancelButton}
              />
              {selected.docUrl && !logic.saving && (
                <a
                  className={styles['where']}
                  href={selected.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e): void => {
                    // The Wails host opens it in the system browser; target="_blank" is the fallback.
                    if (
                      selected.docUrl &&
                      openInSystemBrowser(selected.docUrl)
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  {selected.freeKey && selected.keySite
                    ? formatMessage(messages.providerFreeKeyLink, {
                        site: selected.keySite,
                      })
                    : formatMessage(messages.providerWhereKey, {
                        provider: selected.name,
                      })}
                </a>
              )}
            </div>
          )}

          {!keyForm && <div className={styles['actions']}>{cancelButton}</div>}
        </div>
      )}

      {confirmingDeleteAll && (
        <ConfirmDialog
          title={formatMessage(messages.providerDeleteAllDialogTitle)}
          Icon={Bin}
          heading={formatMessage(messages.providerDeleteAllDialogHeading)}
          description={formatMessage(messages.providerDeleteAllDialogBody)}
          confirmLabel={formatMessage(messages.providerDeleteAll)}
          destructive
          loading={logic.removingAll}
          onConfirm={(): void => {
            void logic.removeAll().then(() => setConfirmingDeleteAll(false));
          }}
          onClose={(): void => setConfirmingDeleteAll(false)}
        />
      )}

      {logic.error && (
        <Text size={TextSize.XXXSmall} className={styles['error']}>
          <StatusError className={styles['error-icon']} aria-hidden="true" />
          {describeError(logic.error, formatMessage)}
        </Text>
      )}

      {logic.refusedSignIn && (
        <Text size={TextSize.XXXSmall} className={styles['error']}>
          <StatusError className={styles['error-icon']} aria-hidden="true" />
          {busyText(logic.refusedSignIn)}
        </Text>
      )}
    </div>
  );
};

export default ProviderCredentials;
