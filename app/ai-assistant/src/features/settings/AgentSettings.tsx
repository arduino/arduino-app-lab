import {
  Disconnect,
  Sparkle,
  Switch,
} from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../messages';
import {
  type AgentCardBadge,
  AgentAction,
  AgentCard,
  Button,
  ConfirmDialog,
  Text,
  Toast,
} from '../../ui';
import { AgentAuthFlow } from '../connect/AgentAuthFlow';
import styles from './agent-settings.module.scss';
import {
  formatConnectedAgo,
  formatConnectedDate,
  useAgentSettingsLogic,
} from './AgentSettings.logic';
import { RuntimePanel } from './RuntimePanel';

export const AgentSettings: React.FC = () => {
  const { formatMessage } = useI18n();
  const {
    agents,
    cardState,
    flow,
    runtime,
    error,
    showConfirm,
    confirmTarget,
    currentDefaultAgent,
    showSetAsDefault,
    openConfirm,
    closeConfirm,
    toggleManage,
    connect,
    cancelFlow,
    install,
    disconnectAgent,
    makeDefault,
    dismissError,
    connectedAgent,
    dismissConnected,
  } = useAgentSettingsLogic();

  return (
    <section className={styles['section']}>
      <div className={styles['header']}>
        <Sparkle className={styles['header-icon']} aria-hidden="true" />
        <Text size={TextSize.XSmall} bold>
          {formatMessage(messages.settingsAgentTitle)}
        </Text>
      </div>

      <ul className={styles['list']}>
        {agents.map((agent) => {
          const {
            showAuthFlow,
            connectedAuth,
            expanded,
            busy,
            runtimeMissing,
            installingRuntime,
          } = cardState(agent);

          const methodLabel = formatMessage(
            connectedAuth?.method === 'api_key'
              ? messages.settingsMethodApiKey
              : messages.settingsMethodOAuth,
          );

          const badges: AgentCardBadge[] = connectedAuth
            ? [
                {
                  label: formatMessage(messages.settingsConnectedBadge),
                  kind: 'connected',
                },
              ]
            : [];

          let subtitle: React.ReactNode = agent.description;
          if (connectedAuth) {
            const when = formatConnectedAgo(connectedAuth.connectedAt);
            const account = connectedAuth.account ?? '';
            subtitle = when
              ? formatMessage(messages.settingsStatusLine, {
                  method: methodLabel,
                  account,
                  when,
                })
              : `${methodLabel} ${account}`.trim();
          }

          return (
            <li key={agent.id}>
              <AgentCard
                agent={agent}
                badges={badges}
                subtitle={subtitle}
                action={
                  <AgentAction
                    comingSoon={Boolean(agent.comingSoon)}
                    cancelling={showAuthFlow}
                    installing={installingRuntime}
                    installProgressPct={runtime.progress?.pct ?? 0}
                    installed={!runtimeMissing}
                    connected={Boolean(connectedAuth)}
                    expanded={expanded}
                    onCancel={cancelFlow}
                    onInstall={(): void => void install(agent.id)}
                    onConnect={(): void => connect(agent.id)}
                    onManage={(): void => toggleManage(agent.id)}
                  />
                }
                expanded={
                  showAuthFlow ||
                  (Boolean(connectedAuth) &&
                    expanded &&
                    !runtimeMissing &&
                    !installingRuntime)
                }
              >
                {showAuthFlow ? (
                  <AgentAuthFlow agent={agent} flow={flow} />
                ) : connectedAuth ? (
                  <div className={styles['details']}>
                    <dl className={styles['grid']}>
                      <div className={styles['row']}>
                        <dt>{formatMessage(messages.settingsSignInMethod)}</dt>
                        <dd>{methodLabel}</dd>
                      </div>
                      <div className={styles['row']}>
                        <dt>{formatMessage(messages.settingsConnectedRow)}</dt>
                        <dd>
                          {formatConnectedDate(connectedAuth.connectedAt)}
                        </dd>
                      </div>
                      <div className={styles['row']}>
                        <dt>{formatMessage(messages.settingsAccountRow)}</dt>
                        <dd>{connectedAuth.account ?? '—'}</dd>
                      </div>
                    </dl>

                    <div className={styles['footer']}>
                      <div className={styles['footer-actions']}>
                        {showSetAsDefault && (
                          <button
                            type="button"
                            className={styles['footer-default-button']}
                            onClick={(): void =>
                              openConfirm('switch', agent.id)
                            }
                            disabled={connectedAuth.isDefault}
                          >
                            {formatMessage(messages.settingsSetAsDefault)}
                          </button>
                        )}
                        <Button
                          variant={ButtonVariant.Secondary}
                          appearance={ButtonAppearance.Destructive}
                          loading={busy}
                          size="small"
                          onClick={(): void =>
                            openConfirm('disconnect', agent.id)
                          }
                        >
                          {formatMessage(messages.settingsDisconnect)}
                        </Button>
                      </div>
                    </div>

                    <RuntimePanel agent={agent} runtime={runtime} />
                  </div>
                ) : null}
              </AgentCard>
            </li>
          );
        })}
      </ul>

      {showConfirm?.kind === 'disconnect' && confirmTarget && (
        <ConfirmDialog
          title={formatMessage(messages.settingsDisconnectDialogTitle)}
          Icon={Disconnect}
          heading={formatMessage(messages.settingsDisconnectDialogHeading, {
            agent: confirmTarget.name,
          })}
          description={formatMessage(messages.settingsDisconnectDialogBody)}
          confirmLabel={formatMessage(messages.settingsDisconnect)}
          destructive
          loading={cardState(confirmTarget).busy}
          onConfirm={(): void => {
            void disconnectAgent(confirmTarget.id).then(closeConfirm);
          }}
          onClose={closeConfirm}
        />
      )}

      {showConfirm?.kind === 'switch' && confirmTarget && (
        <ConfirmDialog
          title={formatMessage(messages.settingsSwitchDialogTitle)}
          Icon={Switch}
          heading={formatMessage(messages.settingsSwitchDialogHeading, {
            agent: confirmTarget.name,
          })}
          description={formatMessage(messages.settingsSwitchDialogBody, {
            agent: confirmTarget.name,
            current: currentDefaultAgent?.name ?? '—',
          })}
          confirmLabel={formatMessage(messages.settingsSwitchDialogConfirm)}
          loading={cardState(confirmTarget).busy}
          onConfirm={(): void => {
            void makeDefault(confirmTarget.id).then(closeConfirm);
          }}
          onClose={closeConfirm}
        />
      )}

      {error !== undefined && (
        <Toast
          onDismiss={dismissError}
          dismissLabel={formatMessage(messages.dismiss)}
        >
          {error || formatMessage(messages.toastVerifyFailed)}
        </Toast>
      )}

      {connectedAgent && (
        <Toast
          variant="success"
          autoDismiss
          onDismiss={dismissConnected}
          dismissLabel={formatMessage(messages.dismiss)}
        >
          {formatMessage(messages.connectedToast, {
            agent: connectedAgent.name,
          })}
        </Toast>
      )}
    </section>
  );
};

export default AgentSettings;
