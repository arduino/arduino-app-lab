import {
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { messages } from '../../../messages';
import { connectWithoutKey } from '../../../services';
import { useAiAssistantStore } from '../../../store';
import { AgentAction, AgentCard, Text, Toast } from '../../../ui';
import { AgentAuthFlow } from '../AgentAuthFlow/AgentAuthFlow';
import { agentDescription } from '../utils/agentDescription';
import { describeError } from '../utils/describeError';
import { useAgentAuthFlow } from '../utils/useAgentAuthFlow';
import styles from './connect-panel.module.scss';
import { useConnectPanelLogic } from './ConnectPanel.logic';

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
    notice,
    dismissNotice,
    notify,
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
    place: formatMessage(messages.placeAgentMode),
  });

  // Cancel/Connect reset the shared auth flow so the tabs start fresh and any
  // in-flight sign-in is dropped.
  const handleCancel = useCallback((): void => {
    flow.reset();
    cancel();
  }, [flow, cancel]);

  // An agent on free models has nothing to ask for: Connect starts it, and keys stay optional in Settings.
  // One with provider keys opens its card first, to add keys before Start building.
  const handleConnect = useCallback(
    (agentId: typeof agents[number]['id']): void => {
      flow.reset();
      const agent = agents.find((a) => a.id === agentId);
      if (agent?.usableWithoutKey && !agent.perProviderKeys) {
        void connectWithoutKey(agentId)
          .then(() => finishAuth(agentId))
          .catch((e: unknown) =>
            showError(e instanceof Error ? e.message : String(e)),
          );
        return;
      }
      connect(agentId);
    },
    [agents, connect, finishAuth, flow, showError],
  );

  const handleStartBuilding = useCallback(
    async (agentId: typeof agents[number]['id']): Promise<void> => {
      try {
        await connectWithoutKey(agentId);
        await finishAuth(agentId);
      } catch (e) {
        showError(e instanceof Error ? e.message : String(e));
      }
    },
    [finishAuth, showError],
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
    <section className={styles['panel']}>
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
                  subtitle={agentDescription(agent, formatMessage)}
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
                      // Nothing to connect: its card opens to the providers and Start building.
                      manageOnly={Boolean(agent.usableWithoutKey)}
                      busy={anyInstalling}
                      onCancel={handleCancel}
                      onInstall={(): void => void handleInstall(agent.id)}
                      onConnect={(): void => handleConnect(agent.id)}
                      onManage={(): void => handleConnect(agent.id)}
                    />
                  }
                >
                  <AgentAuthFlow
                    agent={agent}
                    flow={flow}
                    onStartBuilding={
                      agent.perProviderKeys && agent.usableWithoutKey
                        ? (): Promise<void> => handleStartBuilding(agent.id)
                        : undefined
                    }
                    onNotify={notify}
                    place={formatMessage(messages.placeAgentMode)}
                  />
                </AgentCard>
              </li>
            );
          })}
        </ul>
      </div>

      {(toast !== undefined || notice !== undefined) && (
        <div className={styles['connect-toast']}>
          {toast !== undefined && (
            <Toast
              onDismiss={dismissToast}
              dismissLabel={formatMessage(messages.dismiss)}
            >
              {describeError(toast, formatMessage) ||
                formatMessage(messages.toastVerifyFailed)}
            </Toast>
          )}
          {notice !== undefined && (
            <Toast
              // Keyed by its text: a second notice restarts the timer the first one left running.
              key={notice}
              variant="success"
              autoDismiss
              onDismiss={dismissNotice}
              dismissLabel={formatMessage(messages.dismiss)}
            >
              {notice}
            </Toast>
          )}
        </div>
      )}
    </section>
  );
};

export default ConnectPanel;
