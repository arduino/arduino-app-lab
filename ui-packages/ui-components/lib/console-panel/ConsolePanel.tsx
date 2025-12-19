import { Config, setCSSVariable } from '@cloud-editor-mono/common';
import { Copy, Sparkle } from '@cloud-editor-mono/images/assets/icons';
import { Plans, TransmissionTag } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';

import { ViewInstances } from '../code-mirror/codeMirrorViewInstances';
import { Button } from '../essential/button';
import { IconButton } from '../essential/icon-button';
import { ProgressBar } from '../essential/progress-bar';
import { useI18n } from '../i18n/useI18n';
import { useTooltip } from '../tooltip';
import { Link, XSmall, XXSmall } from '../typography';
import styles from './console-panel.module.scss';
import { ConsolePanelLogic, ConsolePanelStatus } from './consolePanel.type';
import {
  useConsoleCopy,
  useConsoleMessages,
  useConsoleStatus,
} from './consolePanelHooks';
import { messages } from './messages';
import ConsoleElement from './subcomponents/ConsoleElement';
import ConsoleHelperSection from './subcomponents/ConsoleHelperSection';

interface ConsolePanelProps {
  consolePanelLogic: ConsolePanelLogic;
  isCollapsed: boolean;
  statusBarHeight?: number;
  onCollapse: () => void;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({
  consolePanelLogic,
  isCollapsed,
  onCollapse,
  statusBarHeight = 52,
}: ConsolePanelProps) => {
  const {
    getOutputStringInstanceId,
    getOutputString,
    status = ConsolePanelStatus.IDLE,
    progression,
    sketchName,
    errorLines,
    errReason,
    sendTextMessage,
    compileResultMessages,
    canUseGenAi,
    aiUserPlan,
    genAiMessageUsageExceeded,
    upgradePlanLinkEnabled,
  } = consolePanelLogic();

  const { formatMessage } = useI18n();

  const output = (getOutputString && getOutputString()) || '';

  //Messages and console UI icons
  const {
    collapseLabel,
    collapseIcon,
    consoleLabel,
    StatusBarMessage,
    fixErrorWithAI,
    fixThisError,
  } = useConsoleMessages(sketchName, isCollapsed, compileResultMessages);

  //Copy to Clipboard management
  const { CopyTooltipMessage, onCopyOutput, copyTooltipText } =
    useConsoleCopy(output);

  //Manage console status
  const { statusClass, StatusIcon, statusText, busy, progress } =
    useConsoleStatus(status, StatusBarMessage, progression);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: (
      <div className={styles['upgrade-plan-tooltip-content']}>
        <div>
          {aiUserPlan === Plans.MAKER
            ? formatMessage(messages.plan1500LimitsReachedContent, {
                limit1500messages: (
                  <XXSmall bold>
                    {formatMessage(messages.limit1500messages)}
                  </XXSmall>
                ),
                unlockUnlimitedAccess: (
                  <XXSmall bold>
                    {formatMessage(messages.unlockUnlimitedAccess)}
                  </XXSmall>
                ),
              })
            : aiUserPlan === Plans.FREE
            ? formatMessage(messages.plan50LimitsReachedContent, {
                limit50Messages: (
                  <XXSmall bold>
                    {formatMessage(messages.limit50messages)}
                  </XXSmall>
                ),
              })
            : null}
        </div>
        {upgradePlanLinkEnabled ? (
          <Link
            href={Config.DIGITAL_STORE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <XXSmall bold uppercase>
              {formatMessage(messages.planLimitsReachedLink)}
            </XXSmall>
          </Link>
        ) : null}
      </div>
    ),
    title: formatMessage(messages.planLimitsReachedTitle),
    direction: 'up',
  });

  setCSSVariable(
    styles.consolePanelHeight,
    `calc(100% - ${statusBarHeight}px)`,
  );
  setCSSVariable(styles.consolePanelStatusBarHeight, `${statusBarHeight}px`);
  return (
    <div className={clsx(styles['console-panel'], statusClass)}>
      <div>
        <ProgressBar active={busy} progress={progress} />
        <div className={styles['status-bar']}>
          <div className={styles['status-bar-content']}>
            <XSmall monospace>{consoleLabel}</XSmall>
            {StatusIcon ? <StatusIcon /> : null}
            {statusText ? (
              <XSmall monospace className={styles['status-message']}>
                {statusText} {progress ? `${progress}%` : ''}
              </XSmall>
            ) : null}
          </div>
          <IconButton
            onPress={onCollapse}
            label={collapseLabel}
            Icon={collapseIcon}
            classes={{ button: styles['collapse-button'] }}
          />
        </div>
      </div>
      <div className={styles['console-output']}>
        {output ? (
          <IconButton
            Icon={Copy}
            label={copyTooltipText}
            onPress={onCopyOutput}
            classes={{ button: styles['copy-output'] }}
          >
            {copyTooltipText ? (
              <div
                role="tooltip"
                aria-hidden="true"
                className={clsx({
                  [styles['copied-success']]:
                    copyTooltipText === CopyTooltipMessage.COPIED,
                  [styles['copied-error']]:
                    copyTooltipText === CopyTooltipMessage.ERROR,
                })}
              >
                <XXSmall>{copyTooltipText}</XXSmall>
              </div>
            ) : null}
          </IconButton>
        ) : null}
        <div className={styles['console-output-wrapper']}>
          <div
            className={clsx(styles['console-output-content-wrapper'], {
              [styles['ai-suggestions-enabled']]:
                canUseGenAi &&
                status === ConsolePanelStatus.ERROR &&
                compileResultMessages,
            })}
          >
            {getOutputString && getOutputString() ? (
              <ConsoleElement
                viewInstanceId={ViewInstances.Console}
                classes={{ container: styles['console-output-content'] }}
                getValueInstanceId={getOutputStringInstanceId}
                getValue={getOutputString}
                errorLines={errorLines}
              />
            ) : null}
            {!progress && !output ? (
              <ConsoleHelperSection status={status} errReason={errReason} />
            ) : null}
          </div>
          {canUseGenAi &&
          status === ConsolePanelStatus.ERROR &&
          compileResultMessages ? (
            <div
              {...tooltipProps}
              className={clsx(styles['gen-ai-buttons'], {
                [styles['is-disabled']]: genAiMessageUsageExceeded,
              })}
            >
              <Button
                Icon={Sparkle}
                iconPosition="left"
                onClick={(): void => {
                  sendTextMessage(
                    fixThisError,
                    TransmissionTag.ErrorFixRequest,
                  );
                }}
                classes={{ button: styles['fix-error-button'] }}
              >
                <XXSmall bold>{fixErrorWithAI}</XXSmall>
              </Button>
              {genAiMessageUsageExceeded
                ? renderTooltip(styles['upgrade-plan-tooltip'])
                : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ConsolePanel;
