import {
  Checkmark,
  FileCopy,
  OpenInNewTab,
  StatusError,
} from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonVariant,
  Input,
  InputStyle,
  TextSize,
  useI18n,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useState } from 'react';

import { messages } from '../../../messages';
import { type AgentDescriptor } from '../../../services';
import { Button, Text } from '../../../ui';
import { openInSystemBrowser } from '../../../utils';
import { ApiKeyField } from '../ApiKeyField/ApiKeyField';
import { ProviderCredentials } from '../ProviderCredentials/ProviderCredentials';
import { StartBuildingButton } from '../StartBuildingButton/StartBuildingButton';
import { type AuthTab } from '../utils/useAgentAuthFlow';
import styles from './agent-auth.module.scss';

type AgentAuthProps = {
  agent: AgentDescriptor;
  authTab: AuthTab;
  signingIn: boolean;
  authUrl?: string;
  onSignIn: () => Promise<void>;
  tokenEntry: boolean;
  onShowTokenEntry: VoidFunction;
  loginToken: string;
  onLoginTokenChange: (value: string) => void;
  tokenError: boolean;
  verifyingToken: boolean;
  onSubmitToken: (token?: string) => Promise<void>;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  apiKeyError: boolean;
  verifying: boolean;
  onVerify: () => Promise<void>;
  // Called once the agent has its first provider credential (agents with no single key).
  onCredentialAdded: () => Promise<void>;
  // Given, an agent with provider keys gets a button that starts it with the keys added so far.
  onStartBuilding?: () => Promise<void>;
  // Where the provider form says a key change went through; its failures stay on its own line.
  onNotify?: (message: string, kind: 'error' | 'success') => void;
  // Where this surface is, named to the other one when it refuses a second provider sign-in.
  place?: string;
};

// Auth options for an expanded agent card. The three states (sign-in waiting —
// which also hosts the manual token fallback —, sign-in prompt, api-key form)
// are mutually exclusive and checked in order.
export const AgentAuth: React.FC<AgentAuthProps> = ({
  agent,
  authTab,
  signingIn,
  authUrl,
  onSignIn,
  tokenEntry,
  onShowTokenEntry,
  loginToken,
  onLoginTokenChange,
  tokenError,
  verifyingToken,
  onSubmitToken,
  apiKey,
  onApiKeyChange,
  apiKeyError,
  verifying,
  onVerify,
  onCredentialAdded,
  onStartBuilding,
  onNotify,
  place,
}) => {
  const { formatMessage } = useI18n();
  const [urlCopied, setUrlCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [credentialsBusy, setCredentialsBusy] = useState(false);

  // Shown on the token field while the flow is live, and kept on the idle
  // sign-in screen once a rejected token has ended it.
  const tokenErrorNode = tokenError ? (
    <XXXSmall className={styles['field-error']}>
      <StatusError className={styles['field-error-icon']} aria-hidden="true" />
      {formatMessage(messages.signInTokenError)}
    </XXXSmall>
  ) : null;

  const copyAuthUrl = async (url: string): Promise<void> => {
    await navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 1500);
  };

  // Sign-in tab, flow in progress: waiting screen with the (copyable) auth URL
  // and a spinner until the browser confirmation comes back.
  if (authTab === 'signin' && signingIn) {
    return (
      <div className={styles['signin-waiting']}>
        <Text size={TextSize.XXSmall} className={styles['signin-waiting-text']}>
          {formatMessage(messages.signInBrowserOpening)}{' '}
          <span className={styles['signin-waiting-hint']}>
            {formatMessage(messages.signInOpenLinkHint)}
          </span>
        </Text>
        {authUrl && (
          <div className={styles['auth-url']}>
            <span className={styles['auth-url-text']} title={authUrl}>
              {authUrl}
            </span>
            <button
              type="button"
              className={styles['auth-url-copy']}
              aria-label={formatMessage(messages.copyLink)}
              onClick={(): void => void copyAuthUrl(authUrl)}
            >
              {urlCopied ? (
                <Checkmark
                  className={styles['auth-url-copy-icon']}
                  aria-hidden="true"
                />
              ) : (
                <FileCopy
                  className={styles['auth-url-copy-icon']}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        )}
        {!verifyingToken && (
          <div className={styles['signin-waiting-status']}>
            <span
              className={styles['signin-waiting-spinner']}
              aria-hidden="true"
            />
            <Text size={TextSize.XXSmall} className={styles['hint']}>
              {formatMessage(messages.signInWaiting)}
            </Text>
          </div>
        )}

        {/* Escape hatch for a browser that never opened (or opened elsewhere):
            reveal a field for the token the provider's page shows. */}
        {!tokenEntry ? (
          <div className={styles['paste-token-row']}>
            <Text
              size={TextSize.XXSmall}
              className={styles['paste-token-hint']}
            >
              {formatMessage(messages.signInPasteTokenHint)}
            </Text>
            <button
              type="button"
              className={styles['paste-token-btn']}
              onClick={onShowTokenEntry}
            >
              {formatMessage(messages.signInPasteToken)}
            </button>
          </div>
        ) : (
          <>
            <Input
              inputStyle={InputStyle.AppLab}
              surface="below-1"
              value={loginToken}
              onChange={onLoginTokenChange}
              // Pasting is the whole point of the field, so it verifies right
              // away — the paste replaces the value rather than merging into it.
              onPaste={(e): void => {
                const pasted = e.clipboardData.getData('text').trim();
                if (pasted === '') {
                  return;
                }
                e.preventDefault();
                void onSubmitToken(pasted);
              }}
              onEnter={(): void => void onSubmitToken()}
              autoFocus
              disabled={verifyingToken}
              placeholder={formatMessage(messages.signInTokenPlaceholder)}
              aria-label={formatMessage(messages.signInTokenLabel)}
            />
            {verifyingToken && (
              <div className={styles['signin-waiting-status']}>
                <span
                  className={styles['signin-waiting-spinner']}
                  aria-hidden="true"
                />
                <Text size={TextSize.XXSmall} className={styles['hint']}>
                  {formatMessage(messages.signInVerifyingToken)}
                </Text>
              </div>
            )}
          </>
        )}

        {tokenErrorNode}
      </div>
    );
  }

  // Sign-in tab, idle: the button that kicks off the browser OAuth flow.
  if (authTab === 'signin') {
    return (
      <div className={styles['signin']}>
        <Button
          variant={ButtonVariant.Primary}
          onClick={onSignIn}
          Icon={OpenInNewTab}
          iconPosition="left"
        >
          {formatMessage(messages.signInWith, { provider: agent.provider })}
        </Button>
        <Text size={TextSize.XXSmall} className={styles['hint']}>
          {formatMessage(messages.signInHint, { provider: agent.provider })}
        </Text>
        {tokenErrorNode}
      </div>
    );
  }

  // A bring-your-own-provider agent has no single key: it has one per provider, so the tab manages a set.
  if (agent.perProviderKeys) {
    if (!onStartBuilding) {
      return (
        <ProviderCredentials
          agent={agent}
          onFirstCredential={onCredentialAdded}
          onNotify={onNotify}
          inlineErrors
          place={place}
        />
      );
    }
    return (
      <div className={styles['providers']}>
        <ProviderCredentials
          agent={agent}
          className={styles['provider-credentials']}
          onNotify={onNotify}
          inlineErrors
          onBusyChange={setCredentialsBusy}
          place={place}
        />
        <div className={styles['start-row']}>
          <StartBuildingButton
            loading={starting}
            // The agent reads its keys at start: one still being checked, or a sign-in still waiting, would miss it.
            disabled={starting || credentialsBusy}
            onClick={(): void => {
              setStarting(true);
              void onStartBuilding().finally(() => setStarting(false));
            }}
          />
        </div>
      </div>
    );
  }

  // API-key tab: paste-and-verify form with inline format error and a hint on
  // where to find the key.
  const keyLabel = formatMessage(messages.apiKeyLabel, {
    provider: agent.provider,
  });
  return (
    <div className={styles['apikey']}>
      <ApiKeyField
        masked
        disabled={verifying}
        value={apiKey}
        onChange={onApiKeyChange}
        onVerify={onVerify}
        placeholder={`${agent.apiKeyPrefix}…`}
        label={keyLabel}
        ariaLabel={keyLabel}
        verifying={verifying}
        verifyLabel={formatMessage(
          verifying ? messages.verifying : messages.verify,
        )}
      />
      {apiKeyError && (
        <XXXSmall className={styles['field-error']}>
          <StatusError
            className={styles['field-error-icon']}
            aria-hidden="true"
          />
          {formatMessage(messages.apiKeyFormatError, {
            prefix: agent.apiKeyPrefix,
          })}
        </XXXSmall>
      )}
      {agent.apiKeyUrl ? (
        <a
          className={styles['where']}
          href={agent.apiKeyUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e): void => {
            // In the Wails host, hand the URL to the runtime so it opens in the
            // system browser; `target="_blank"` is the fallback for plain browsers.
            if (agent.apiKeyUrl && openInSystemBrowser(agent.apiKeyUrl)) {
              e.preventDefault();
            }
          }}
        >
          {formatMessage(messages.whereApiKey, { provider: agent.provider })}
        </a>
      ) : null}
    </div>
  );
};

export default AgentAuth;
