import { Bin, ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import { messages } from '../../messages';
import { type AgentDescriptor } from '../../services';
import { Button, ConfirmDialog, ProgressBar, Text } from '../../ui';
import styles from './runtime-panel.module.scss';
import { type RuntimePanelLogic, formatDiskUsage } from './RuntimePanel.logic';

interface RuntimePanelProps {
  agent: AgentDescriptor;
  // Shared runtime logic (owned by AgentSettings so the card can also read the
  // install state to switch between Manage and Install).
  runtime: RuntimePanelLogic;
}

// Collapsible "Runtime & Packages" block inside a connected agent's Manage
// details: shows install status/version/disk usage, checks for updates, and
// uninstalls — the latter two run an inline progress bar with a cancel
// affordance. Only rendered while the runtime is installed (the card handles
// the missing/install state), so it never offers an Install action itself.
export const RuntimePanel: React.FC<RuntimePanelProps> = ({
  agent,
  runtime,
}) => {
  const { formatMessage } = useI18n();
  const {
    statusById,
    expandedId,
    operation,
    progress,
    // checkingId,      // hidden with the "Check for updates" button
    // upToDateId,      // hidden with the "Check for updates" button
    // checkForUpdates, // hidden with the "Check for updates" button
    confirmingUninstallId,
    toggle,
    openUninstall,
    closeUninstall,
    runUninstall,
    cancelOperation,
  } = runtime;

  const runtimeStatus = statusById[agent.id];
  const expanded = expandedId === agent.id;
  const confirmingUninstall = confirmingUninstallId === agent.id;
  const activeOp = operation?.agentId === agent.id ? operation.kind : undefined;
  // const checking = checkingId === agent.id; // hidden with the "Check for updates" button
  // const upToDate = upToDateId === agent.id; // hidden with the "Check for updates" button

  const version = runtimeStatus?.version;
  const disk = formatDiskUsage(runtimeStatus?.diskUsageBytes);
  const summary = version ? `${version}${disk ? ` · ${disk}` : ''}` : undefined;

  const pct = Math.max(0, Math.min(100, Math.round(progress?.pct ?? 0)));
  const operationLabel = {
    install: messages.settingsRuntimeInstalling,
    update: messages.settingsRuntimeUpdating,
    uninstall: messages.settingsRuntimeUninstalling,
  }[activeOp ?? 'update'];

  return (
    <div className={styles['runtime']}>
      <button
        type="button"
        className={styles['runtime-header']}
        onClick={(): void => toggle(agent.id)}
        aria-expanded={expanded}
      >
        <span className={styles['runtime-header-title']}>
          <ChevronDown
            className={clsx(styles['runtime-chevron'], {
              [styles['runtime-chevron--expanded']]: expanded,
            })}
            aria-hidden="true"
          />
          {formatMessage(messages.settingsRuntimeTitle)}
        </span>
        {summary && (
          <span className={styles['runtime-header-summary']}>{summary}</span>
        )}
      </button>

      {expanded &&
        (activeOp ? (
          <div className={styles['runtime-progress']}>
            <div className={styles['runtime-progress-row']}>
              <span className={styles['runtime-spinner']} aria-hidden="true" />
              <Text className={styles['runtime-progress-label']}>
                {formatMessage(operationLabel)}
              </Text>
              <span className={styles['runtime-progress-pct']}>{pct}%</span>
            </div>
            <ProgressBar
              className={styles['runtime-progress-bar']}
              value={pct}
              label={formatMessage(operationLabel)}
            />
            {/* Uninstall isn't cancellable — a half-removed runtime would be
                corrupt; only install/update can be safely aborted. */}
            {activeOp !== 'uninstall' && (
              <Button
                variant={ButtonVariant.Tertiary}
                size="small"
                className={styles['runtime-progress-cancel']}
                onClick={(): void => void cancelOperation(agent.id)}
              >
                {formatMessage(messages.cancel)}
              </Button>
            )}
          </div>
        ) : (
          <div className={styles['runtime-body']}>
            <dl className={styles['runtime-stats']}>
              <div className={styles['runtime-stat']}>
                <dt>{formatMessage(messages.settingsRuntimeStatus)}</dt>
                <dd className={styles['runtime-status']}>
                  {formatMessage(messages.settingsRuntimeStatusInstalled)}
                </dd>
              </div>
              <div className={styles['runtime-stat']}>
                <dt>{formatMessage(messages.settingsRuntimeVersion)}</dt>
                <dd>{version ?? '—'}</dd>
              </div>
              <div className={styles['runtime-stat']}>
                <dt>{formatMessage(messages.settingsRuntimeDiskUsage)}</dt>
                <dd>{disk ?? '—'}</dd>
              </div>
            </dl>

            <div className={styles['runtime-actions']}>
              {/* Hidden for now: "Check for updates" button (and its "up to date" note).
              {upToDate ? (
                // Non-interactive confirmation; replaces the check button until
                // it clears, then the button returns.
                <span className={styles['runtime-note']}>
                  {formatMessage(messages.settingsRuntimeUpToDate)}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles['runtime-link']}
                  disabled={checking}
                  onClick={(): void => void checkForUpdates(agent.id)}
                >
                  {checking ? (
                    <>
                      {formatMessage(messages.settingsRuntimeChecking)}
                      <svg
                        className={styles['checking-dots']}
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="3.5" cy="8" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="12.5" cy="8" r="1.5" />
                      </svg>
                    </>
                  ) : (
                    formatMessage(messages.settingsRuntimeCheckUpdates)
                  )}
                </button>
              )}
              */}
              <Button
                variant={ButtonVariant.Tertiary}
                appearance={ButtonAppearance.Destructive}
                size="small"
                onClick={(): void => openUninstall(agent.id)}
              >
                {formatMessage(messages.settingsRuntimeUninstall)}
              </Button>
            </div>
          </div>
        ))}

      {confirmingUninstall && (
        <ConfirmDialog
          title={formatMessage(messages.settingsRuntimeUninstallDialogTitle)}
          Icon={Bin}
          heading={formatMessage(
            messages.settingsRuntimeUninstallDialogHeading,
            { agent: agent.name },
          )}
          description={formatMessage(
            messages.settingsRuntimeUninstallDialogBody,
            {
              size: disk ?? '—',
            },
          )}
          confirmLabel={formatMessage(messages.settingsRuntimeUninstall)}
          destructive
          onConfirm={(): void => void runUninstall(agent.id)}
          onClose={closeUninstall}
        />
      )}
    </div>
  );
};

export default RuntimePanel;
