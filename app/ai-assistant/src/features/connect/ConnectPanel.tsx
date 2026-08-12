import {
  PageLayout,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { messages } from '../../messages';
import { useAiAssistantStore } from '../../store';
import { AgentAction, AgentCard, Header, Text, Toast } from '../../ui';
import { AgentAuthFlow } from './AgentAuthFlow';
import styles from './connect-panel.module.scss';
import { useConnectPanelLogic } from './ConnectPanel.logic';
import { useAgentAuthFlow } from './useAgentAuthFlow';

export const ConnectPanel: React.FC = () => {
  const { formatMessage } = useI18n();
  const sessionExpired = useAiAssistantStore((s) => s.sessionExpired);

  const {
    agents,
    expandedId,
    installingId,
    installedById,
    installProgress,
    toast,
    dismissToast,
    showError,
    installRuntime,
    connect,
    cancel,
    finishAuth,
  } = useConnectPanelLogic();

  const expandedAgent = agents.find((agent) => agent.id === expandedId);
  const flow = useAgentAuthFlow({
    agent: expandedAgent,
    onAuthenticated: finishAuth,
    onError: showError,
  });

  // Cancel/Connect reset the shared auth flow so the tabs start fresh and any
  // in-flight sign-in is dropped.
  const handleCancel = useCallback((): void => {
    flow.reset();
    cancel();
  }, [flow, cancel]);

  const handleConnect = useCallback(
    (agentId: typeof agents[number]['id']): void => {
      flow.reset();
      connect(agentId);
    },
    [flow, connect],
  );

  // A finished install leads straight into the auth options — signing in is the only thing left to
  // do, so the intermediate Connect button would just be an extra click. Cancelling collapses the
  // card back to the Connect CTA, since by then the runtime really is installed.
  const handleInstall = useCallback(
    async (agentId: typeof agents[number]['id']): Promise<void> => {
      if (await installRuntime(agentId)) {
        handleConnect(agentId);
      }
    },
    [installRuntime, handleConnect],
  );

  return (
    <PageLayout header={<Header title={formatMessage(messages.headerTitle)} />}>
      <div className={styles['inner']}>
        <Text size={TextSize.XSmall} className={styles['label']}>
          {formatMessage(messages.connectTitle)}
        </Text>

        <Text size={TextSize.XXSmall} className={styles['description']}>
          {formatMessage(messages.connectSubtitle)}
        </Text>

        {sessionExpired && (
          <Text size={TextSize.XSmall} className={styles['session-expired']}>
            {formatMessage(messages.sessionExpired)}
          </Text>
        )}

        <ul className={styles['agents']}>
          {agents.map((agent) => {
            const expanded = expandedId === agent.id;
            const installed = installedById[agent.id];
            const installing = installingId === agent.id;
            const anyInstalling = installingId !== undefined;
            return (
              <li key={agent.id}>
                <AgentCard
                  agent={agent}
                  subtitle={agent.description}
                  expanded={expanded}
                  action={
                    <AgentAction
                      comingSoon={agent.comingSoon}
                      cancelling={expanded}
                      installing={installing}
                      installProgressPct={installProgress?.pct ?? 0}
                      checking={installed === undefined}
                      installed={installed === true}
                      connected={false}
                      busy={anyInstalling}
                      onCancel={handleCancel}
                      onInstall={(): void => void handleInstall(agent.id)}
                      onConnect={(): void => handleConnect(agent.id)}
                    />
                  }
                >
                  <AgentAuthFlow agent={agent} flow={flow} />
                </AgentCard>
              </li>
            );
          })}
        </ul>
      </div>

      {toast !== undefined && (
        <div className={styles['connect-toast']}>
          <Toast
            onDismiss={dismissToast}
            dismissLabel={formatMessage(messages.dismiss)}
          >
            {toast || formatMessage(messages.toastVerifyFailed)}
          </Toast>
        </div>
      )}
    </PageLayout>
  );
};

export default ConnectPanel;
