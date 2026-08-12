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
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useState } from 'react';

import { messages } from '../../messages';
import { type AgentDescriptor } from '../../services';
import { Button, openInSystemBrowser, Text } from '../../ui';
import styles from './agent-auth.module.scss';
import { type AuthTab } from './useAgentAuthFlow';

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
}) => {
  const { formatMessage } = useI18n();
  const [urlCopied, setUrlCopied] = useState(false);

  // Shown on the token field while the flow is live, and kept on the idle
  // sign-in screen once a rejected token has ended it.
  const tokenErrorNode = tokenError ? (
    <Text size={TextSize.XXXSmall} className={styles['field-error']}>
      <StatusError className={styles['field-error-icon']} aria-hidden="true" />
      {formatMessage(messages.signInTokenError)}
    </Text>
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
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              disabled={verifyingToken}
              placeholder={formatMessage(messages.signInTokenPlaceholder)}
              aria-label={formatMessage(messages.signInTokenLabel)}
              classes={{
                input: styles['token-input-root'],
                inputContainer: styles['token-input-container'],
              }}
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
          {formatMessage(messages.signInHint)}
        </Text>
        {tokenErrorNode}
      </div>
    );
  }

  // API-key tab: paste-and-verify form with inline format error and a hint on
  // where to find the key.
  return (
    <div className={styles['apikey']}>
      <div className={styles['apikey-row']}>
        <Input
          inputStyle={InputStyle.AppLab}
          value={apiKey}
          onChange={onApiKeyChange}
          onEnter={onVerify}
          placeholder={`${agent.apiKeyPrefix}…`}
          label={formatMessage(messages.apiKeyLabel, {
            provider: agent.provider,
          })}
          className={styles['apikey-input']}
          classes={{
            input: styles['apikey-input-root'],
            inputContainer: styles['apikey-input-container'],
            inputLabel: styles['apikey-input-label'],
          }}
        />
        <Button
          variant={ButtonVariant.Primary}
          loading={verifying}
          disabled={apiKey.trim() === ''}
          onClick={onVerify}
          className={styles['verify-btn']}
        >
          {formatMessage(verifying ? messages.verifying : messages.verify)}
        </Button>
      </div>
      {apiKeyError && (
        <Text size={TextSize.XXXSmall} className={styles['field-error']}>
          <StatusError
            className={styles['field-error-icon']}
            aria-hidden="true"
          />
          {formatMessage(messages.apiKeyFormatError, {
            prefix: agent.apiKeyPrefix,
          })}
        </Text>
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
