import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';
import { type MessageDescriptor } from 'react-intl';

import { messages } from '../../../messages';
import { type AgentDescriptor } from '../../../services';
import { AgentAuth } from '../AgentAuth/AgentAuth';
import {
  type AgentAuthFlowState,
  type AuthTab,
} from '../utils/useAgentAuthFlow';
import styles from './agent-auth-flow.module.scss';

type AgentAuthFlowProps = {
  agent: AgentDescriptor;
  flow: AgentAuthFlowState;
  onStartBuilding?: () => Promise<void>;
  onNotify?: (message: string, kind: 'error' | 'success') => void;
  // Where this surface is, named to the other one when it refuses a second provider sign-in.
  place?: string;
};

// The shared Sign in / API Key surface: a tab switcher + the AgentAuth form.
// Both the connect panel and the Settings "Agent" section render this identically.
export const AgentAuthFlow: React.FC<AgentAuthFlowProps> = ({
  agent,
  flow,
  onStartBuilding,
  onNotify,
  place,
}) => {
  const { formatMessage } = useI18n();
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // Slide the toggle highlight under the active tab (measured to fit each
  // segment's own width).
  const tabRefs = useRef<Partial<Record<AuthTab, HTMLButtonElement | null>>>(
    {},
  );

  useLayoutEffect(() => {
    const active = tabRefs.current[flow.authTab];
    if (!active) {
      return;
    }
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [flow.authTab]);

  const tabLabel: Record<AuthTab, MessageDescriptor> = {
    signin: messages.tabSignIn,
    apikey: messages.tabApiKey,
  };

  return (
    <>
      {/* One way in needs no switcher, and a lone tab reads as a choice the user does not have. */}
      {flow.authTabs.length > 1 && (
        <div className={styles['tabs']} role="tablist">
          <span
            className={styles['tab-indicator']}
            aria-hidden="true"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
            }}
          />
          {flow.authTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              ref={(el): void => {
                tabRefs.current[tab] = el;
              }}
              aria-selected={flow.authTab === tab}
              className={clsx(
                styles['tab'],
                flow.authTab === tab && styles['tab--active'],
              )}
              onClick={(): void => flow.setAuthTab(tab)}
            >
              {formatMessage(tabLabel[tab])}
            </button>
          ))}
        </div>
      )}

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
        onCredentialAdded={flow.credentialAdded}
        onStartBuilding={onStartBuilding}
        onNotify={onNotify}
        place={place}
      />
    </>
  );
};

export default AgentAuthFlow;
