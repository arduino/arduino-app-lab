import {
  Disconnect,
  Sparkle,
  Switch,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AGENT_SETTINGS_SECTION_ID,
  ButtonAppearance,
  ButtonVariant,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useLayoutEffect, useState } from 'react';

import { messages } from '../../messages';
import {
  type AgentCardBadge,
  AgentAction,
  AgentCard,
  Blocked,
  Button,
  ConfirmDialog,
  Text,
  Toast,
} from '../../ui';
import { AgentAuthFlow } from '../connect/AgentAuthFlow/AgentAuthFlow';
import { CredentialRestartNotice } from '../connect/CredentialRestartNotice/CredentialRestartNotice';
import { ProviderCredentials } from '../connect/ProviderCredentials/ProviderCredentials';
import { StartBuildingButton } from '../connect/StartBuildingButton/StartBuildingButton';
import { agentDescription } from '../connect/utils/agentDescription';
import { describeError } from '../connect/utils/describeError';
import styles from './agent-settings.module.scss';
import {
  formatConnectedAgo,
  formatConnectedDate,
  useAgentSettingsLogic,
} from './AgentSettings.logic';
import { RuntimePanel } from './RuntimePanel';

type AgentSettingsProps = {
  // Opens Agent mode; given, a free agent's providers end with a Start building button.
  onStartBuilding?: VoidFunction;
};

export const AgentSettings: React.FC<AgentSettingsProps> = ({
  onStartBuilding,
}) => {
  const { formatMessage } = useI18n();
  // A key still being checked, or a sign-in still waiting: starting the agent now would miss it.
  const [credentialsBusy, setCredentialsBusy] = useState(false);
  const {
    agents,
    cardState,
    flow,
    runtime,
    error,
    turnRunning,
    showConfirm,
    confirmTarget,
    inUseAgent,
    selectedAgentId,
    justInstalledId,
    openConfirm,
    closeConfirm,
    toggleManage,
    connect,
    startBuilding,
    cancelFlow,
    install,
    disconnectAgent,
    activate,
    reloadCredentials,
    notice,
    notify,
    dismissNotice,
    dismissError,
    connectedAgent,
    dismissConnected,
  } = useAgentSettingsLogic(onStartBuilding);

  // Loaded lazily: on a first visit the router scrolls to the hash before this section renders, on a page too short to reach it.
  useLayoutEffect(() => {
    if (window.location.hash === `#${AGENT_SETTINGS_SECTION_ID}`) {
      document.getElementById(AGENT_SETTINGS_SECTION_ID)?.scrollIntoView(true);
    }
  }, []);

  // A default is a choice only between agents that could run: installed and connected.
  const canChooseDefault =
    agents.filter((a) => {
      const state = cardState(a);
      return Boolean(state.connectedAuth) && !state.runtimeMissing;
    }).length >= 2;

  const turnBlock = turnRunning
    ? formatMessage(messages.settingsBusyTurn)
    : undefined;

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

          // No method is the free case; the subscription label would name an account they do not have.
          const methodLabel = formatMessage(
            connectedAuth?.method === 'api_key'
              ? messages.settingsMethodApiKey
              : connectedAuth && !connectedAuth.method
              ? messages.settingsMethodFree
              : messages.settingsMethodOAuth,
          );

          // One answer for the whole card: read apart, they put an account next to a Connect button.
          const inUse = agent.id === selectedAgentId && Boolean(connectedAuth);
          // Nothing to sign into: installed is enough to open its panel, which holds the keys and the uninstall.
          const manageOnly = Boolean(agent.usableWithoutKey) && !runtimeMissing;
          // Only the step after the install; from then on the agent is chosen with Set as default.
          const offerStartBuilding =
            Boolean(onStartBuilding) &&
            Boolean(agent.usableWithoutKey) &&
            justInstalledId === agent.id;

          const badges: AgentCardBadge[] = inUse
            ? [
                {
                  label: formatMessage(messages.settingsConnectedBadge),
                  kind: 'connected',
                },
              ]
            : [];

          let subtitle: React.ReactNode = agentDescription(
            agent,
            formatMessage,
          );
          if (inUse && connectedAuth) {
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
                    installing={installingRuntime}
                    installProgressPct={runtime.progress?.pct ?? 0}
                    installed={!runtimeMissing}
                    // An open sign-in counts: Manage then closes it.
                    connected={Boolean(connectedAuth) || showAuthFlow}
                    manageOnly={manageOnly}
                    blockedReason={turnBlock}
                    expanded={expanded || showAuthFlow}
                    onInstall={(): void => void install(agent.id)}
                    onConnect={(): void => connect(agent.id)}
                    onManage={(): void =>
                      showAuthFlow ? cancelFlow() : toggleManage(agent.id)
                    }
                  />
                }
                expanded={
                  showAuthFlow ||
                  ((Boolean(connectedAuth) || manageOnly) &&
                    expanded &&
                    !runtimeMissing &&
                    !installingRuntime)
                }
              >
                {showAuthFlow ? (
                  <div className={styles['details']}>
                    <AgentAuthFlow
                      agent={agent}
                      flow={flow}
                      onNotify={notify}
                      place={formatMessage(messages.placeSettings)}
                    />
                    <RuntimePanel
                      agent={agent}
                      runtime={runtime}
                      blockedReason={turnBlock}
                    />
                  </div>
                ) : connectedAuth || manageOnly ? (
                  <div className={styles['details']}>
                    {/* An agent with provider keys has no one account: its keys are listed below instead. */}
                    {connectedAuth && !agent.perProviderKeys && (
                      <dl className={styles['grid']}>
                        <div className={styles['row']}>
                          <dt>
                            {formatMessage(messages.settingsSignInMethod)}
                          </dt>
                          <dd>{methodLabel}</dd>
                        </div>
                        <div className={styles['row']}>
                          <dt>
                            {formatMessage(messages.settingsConnectedRow)}
                          </dt>
                          <dd>
                            {formatConnectedDate(connectedAuth.connectedAt)}
                          </dd>
                        </div>
                        <div className={styles['row']}>
                          <dt>{formatMessage(messages.settingsAccountRow)}</dt>
                          <dd>
                            {connectedAuth.account ||
                              formatMessage(messages.settingsAccountFree)}
                          </dd>
                        </div>
                      </dl>
                    )}

                    {/* Reachable after connecting: keys widen the model list, they did not unlock it. */}
                    {agent.perProviderKeys && (
                      <div className={styles['providers-section']}>
                        <ProviderCredentials
                          agent={agent}
                          // A key change restarts only the agent in use, so its turns block it, and so does its restart.
                          blockedReason={
                            (agent.id === selectedAgentId
                              ? turnBlock
                              : undefined) ??
                            (busy
                              ? formatMessage(messages.settingsBusyRestart)
                              : undefined)
                          }
                          onCredentialsChanged={(): void => {
                            void reloadCredentials(agent.id);
                          }}
                          onNotify={notify}
                          place={formatMessage(messages.placeSettings)}
                          onBusyChange={setCredentialsBusy}
                        />
                      </div>
                    )}
                    {agent.perProviderKeys && offerStartBuilding && (
                      <div className={styles['footer']}>
                        <div className={styles['footer-actions']}>
                          <Blocked reason={turnBlock}>
                            <StartBuildingButton
                              loading={busy}
                              disabled={
                                busy || credentialsBusy || Boolean(turnBlock)
                              }
                              onClick={(): void => startBuilding(agent.id)}
                            />
                          </Blocked>
                        </div>
                      </div>
                    )}

                    <RuntimePanel
                      agent={agent}
                      runtime={runtime}
                      blockedReason={turnBlock}
                    />

                    {((canChooseDefault && !offerStartBuilding) ||
                      !manageOnly) && (
                      <div className={styles['footer']}>
                        <div className={styles['footer-actions']}>
                          {canChooseDefault && !offerStartBuilding && (
                            <Blocked reason={turnBlock}>
                              <Button
                                variant={ButtonVariant.Tertiary}
                                appearance={ButtonAppearance.LowContrast}
                                loading={busy}
                                disabled={inUse || busy || Boolean(turnBlock)}
                                size="small"
                                onClick={(): void => connect(agent.id)}
                              >
                                {formatMessage(messages.settingsSetAsDefault)}
                              </Button>
                            </Blocked>
                          )}
                          {!manageOnly && (
                            <Blocked reason={turnBlock}>
                              <Button
                                variant={ButtonVariant.Secondary}
                                appearance={ButtonAppearance.Destructive}
                                // Its own loader is in the confirm dialog; busy here is another action.
                                disabled={busy || Boolean(turnBlock)}
                                size="small"
                                onClick={(): void =>
                                  openConfirm('disconnect', agent.id)
                                }
                              >
                                {formatMessage(messages.settingsDisconnect)}
                              </Button>
                            </Blocked>
                          )}
                        </div>
                      </div>
                    )}
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
          // The agent in use, not the stored default, which read "—" when nothing was in use.
          description={formatMessage(messages.settingsSwitchDialogBody, {
            agent: confirmTarget.name,
            current: inUseAgent?.name ?? '',
          })}
          confirmLabel={formatMessage(messages.settingsSwitchDialogConfirm)}
          loading={cardState(confirmTarget).busy}
          onConfirm={(): void => {
            activate(confirmTarget.id);
            closeConfirm();
          }}
          onClose={closeConfirm}
        />
      )}

      {error !== undefined && (
        <Toast
          onDismiss={dismissError}
          dismissLabel={formatMessage(messages.dismiss)}
        >
          {describeError(error, formatMessage) ||
            formatMessage(messages.toastVerifyFailed)}
        </Toast>
      )}

      <CredentialRestartNotice waitingOnly />

      {notice !== undefined && (
        <Toast
          variant="success"
          autoDismiss
          onDismiss={dismissNotice}
          dismissLabel={formatMessage(messages.dismiss)}
        >
          {notice}
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
