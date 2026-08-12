import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';

import { messages } from '../../messages';
import { type AgentDescriptor } from '../../services';
import styles from './agent-auth-flow.module.scss';
import { AgentAuth } from './AgentAuth';
import { type AgentAuthFlowState, type AuthTab } from './useAgentAuthFlow';

type AgentAuthFlowProps = {
  agent: AgentDescriptor;
  flow: AgentAuthFlowState;
};

// The shared Sign in / API Key surface: a tab switcher + the AgentAuth form.
// Both the connect panel and the Settings "Agent" section render this identically.
export const AgentAuthFlow: React.FC<AgentAuthFlowProps> = ({
  agent,
  flow,
}) => {
  const { formatMessage } = useI18n();
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // Slide the toggle highlight under the active tab (measured to fit each
  // segment's own width).
  const tabRefs = useRef<Record<AuthTab, HTMLButtonElement | null>>({
    signin: null,
    apikey: null,
  });

  useLayoutEffect(() => {
    const active = tabRefs.current[flow.authTab];
    if (!active) {
      return;
    }
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [flow.authTab]);

  return (
    <>
      <div className={styles['tabs']} role="tablist">
        <span
          className={styles['tab-indicator']}
          aria-hidden="true"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
          }}
        />
        <button
          type="button"
          role="tab"
          ref={(el): void => {
            tabRefs.current.signin = el;
          }}
          aria-selected={flow.authTab === 'signin'}
          className={clsx(
            styles['tab'],
            flow.authTab === 'signin' && styles['tab--active'],
          )}
          onClick={(): void => flow.setAuthTab('signin')}
        >
          {formatMessage(messages.tabSignIn)}
        </button>
        <button
          type="button"
          role="tab"
          ref={(el): void => {
            tabRefs.current.apikey = el;
          }}
          aria-selected={flow.authTab === 'apikey'}
          className={clsx(
            styles['tab'],
            flow.authTab === 'apikey' && styles['tab--active'],
          )}
          onClick={(): void => flow.setAuthTab('apikey')}
        >
          {formatMessage(messages.tabApiKey)}
        </button>
      </div>

      <AgentAuth
        agent={agent}
        authTab={flow.authTab}
        signingIn={flow.signingIn}
        authUrl={flow.authUrl}
        onSignIn={flow.signIn}
        tokenEntry={flow.tokenEntry}
        onShowTokenEntry={flow.showTokenEntry}
        loginToken={flow.loginToken}
        onLoginTokenChange={flow.setLoginToken}
        tokenError={flow.tokenError}
        verifyingToken={flow.verifyingToken}
        onSubmitToken={flow.submitToken}
        apiKey={flow.apiKey}
        onApiKeyChange={flow.setApiKey}
        apiKeyError={flow.apiKeyError}
        verifying={flow.verifying}
        onVerify={flow.verifyApiKey}
      />
    </>
  );
};

export default AgentAuthFlow;
