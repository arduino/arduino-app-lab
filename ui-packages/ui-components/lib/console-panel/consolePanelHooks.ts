import {
  ArrowSquaredUp,
  StatusError,
  SubtractMinus,
  Verify,
} from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';
import { useCopyToClipboard, usePreviousDistinct } from 'react-use';
import { IntRange } from 'type-fest';

import { useI18n } from '../i18n/useI18n';
import styles from './console-panel.module.scss';
import {
  ConsolePanelStatus,
  CopyTooltipMessage,
  StatusBarMessage,
} from './consolePanel.type';
import { messages } from './messages';

export const useConsoleMessages = (
  sketchName: string,
  isCollapsed: boolean,
  compileResultMessages?: string,
): {
  collapseLabel: string;
  collapseIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  consoleLabel: string;
  StatusBarMessage: StatusBarMessage;
  fixErrorWithAI: string;
  fixThisError: string;
} => {
  const { formatMessage } = useI18n();
  const StatusBarMessage = {
    VERIFYING: formatMessage(messages.statusVerifying),
    UPLOADING: formatMessage(messages.statusUploading),
    PENDING_OTA: formatMessage(messages.pendingOta),
    AVAILABLE: formatMessage(messages.statusAvailable),
    START: formatMessage(messages.statusStart),
    FETCH: formatMessage(messages.statusFetch),
    FLASH: formatMessage(messages.statusFlash),
    REBOOT: formatMessage(messages.statusReboot),
    FAIL: formatMessage(messages.statusFail),
    VERIFY_SUCCESS: formatMessage(messages.statusVerifySuccess, {
      sketchName,
    }),
    UPLOAD_SUCCESS: formatMessage(messages.statusUploadSuccess, {
      sketchName,
    }),
    VERIFY_ERROR: formatMessage(messages.statusVerifyError, {
      sketchName,
    }),
    UPLOAD_ERROR: formatMessage(messages.statusUploadError, {
      sketchName,
    }),
  } as const;

  const CONSOLE_PANEL_TITLE = formatMessage(messages.title);
  const SHOW_PANEL_LABEL = formatMessage(messages.showPanelButton);
  const HIDE_PANEL_LABEL = formatMessage(messages.hidePanelButton);

  const collapseLabel = isCollapsed ? SHOW_PANEL_LABEL : HIDE_PANEL_LABEL;
  const collapseIcon = isCollapsed ? ArrowSquaredUp : SubtractMinus;
  const consoleLabel = CONSOLE_PANEL_TITLE;
  const fixErrorWithAI = formatMessage(messages.fixErrors);
  const fixThisError = formatMessage(messages.fixThisError, {
    compileResultMessages,
  });
  return {
    collapseLabel,
    collapseIcon,
    consoleLabel,
    StatusBarMessage,
    fixErrorWithAI,
    fixThisError,
  };
};

export const useConsoleCopy = (
  output: string,
): {
  CopyTooltipMessage: CopyTooltipMessage;
  onCopyOutput: () => void;
  copyTooltipText: string;
} => {
  const { formatMessage } = useI18n();
  const CopyTooltipMessage = {
    INITIAL: formatMessage(messages.copyButtonInitial),
    COPIED: formatMessage(messages.copyButtonClicked),
    ERROR: formatMessage(messages.copyButtonError),
  } as const;

  const [{ error }, copyToClipboard] = useCopyToClipboard();
  const [copyTooltipText, setCopyTooltipText] = useState(
    CopyTooltipMessage.INITIAL,
  );
  const [copiedTimeout, setCopiedTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>();

  const onCopyOutput = (): void => {
    if (!output) return;

    copyToClipboard(output);
    if (error) {
      setCopyTooltipText(CopyTooltipMessage.ERROR);
      console.error(error.message);
    } else {
      setCopyTooltipText(CopyTooltipMessage.COPIED);
    }
    if (copiedTimeout) clearTimeout(copiedTimeout);
    setCopiedTimeout(
      setTimeout(() => setCopyTooltipText(CopyTooltipMessage.INITIAL), 2000),
    );
  };

  return { CopyTooltipMessage, onCopyOutput, copyTooltipText };
};

export const useConsoleStatus = (
  status: ConsolePanelStatus,
  StatusBarMessage: StatusBarMessage,
  progression?: IntRange<0, 101>,
): {
  busy: boolean;
  statusClass: string;
  StatusIcon: React.FC<React.SVGProps<SVGSVGElement>> | null;
  statusText: string | null;
  progress?: IntRange<0, 101>;
} => {
  const previousStatus = usePreviousDistinct(status);

  let statusClass = '';
  let statusText: string | null = null;
  let StatusIcon: React.FC | null = null;

  let busy = false;
  let progress: IntRange<0, 101> | undefined = undefined;
  switch (status) {
    case ConsolePanelStatus.VERIFYING:
      busy = true;
      statusText = StatusBarMessage.VERIFYING;
      progress = progression;
      break;
    case ConsolePanelStatus.UPLOADING:
      busy = true;
      statusText = StatusBarMessage.UPLOADING;
      break;
    case ConsolePanelStatus.PENDING_OTA:
      statusClass = styles.progress;
      busy = true;
      statusText = StatusBarMessage.PENDING_OTA;
      break;
    case ConsolePanelStatus.AVAILABLE:
      statusClass = styles.progress;
      busy = true;
      statusText = StatusBarMessage.AVAILABLE;
      break;
    case ConsolePanelStatus.START:
      statusClass = styles.progress;
      busy = true;
      statusText = StatusBarMessage.START;
      break;
    case ConsolePanelStatus.FETCH:
      statusClass = styles.progress;
      busy = true;
      progress = progression || 0;
      statusText = StatusBarMessage.FETCH;
      break;
    case ConsolePanelStatus.FLASH:
      statusClass = styles.progress;
      busy = true;
      statusText = StatusBarMessage.FLASH;
      break;
    case ConsolePanelStatus.REBOOT:
      statusClass = styles.progress;
      busy = true;
      statusText = StatusBarMessage.REBOOT;
      break;
    case ConsolePanelStatus.SUCCESS:
      statusClass = styles.success;
      if (previousStatus === ConsolePanelStatus.VERIFYING) {
        statusText = StatusBarMessage.VERIFY_SUCCESS;
      } else {
        statusText = StatusBarMessage.UPLOAD_SUCCESS;
      }
      StatusIcon = Verify;
      break;
    case ConsolePanelStatus.ERROR:
      statusClass = styles.error;
      if (previousStatus === ConsolePanelStatus.VERIFYING) {
        statusText = StatusBarMessage.VERIFY_ERROR;
      } else {
        statusText = StatusBarMessage.UPLOAD_ERROR;
      }
      StatusIcon = StatusError;
      break;
    case ConsolePanelStatus.IOT_ERROR:
      statusClass = styles.error;
      StatusIcon = StatusError;
      statusText = StatusBarMessage.UPLOAD_ERROR;
      //Text manage by ConsoleHelperSection
      break;
    default:
    case ConsolePanelStatus.IDLE:
      break;
  }

  return { busy, statusClass, StatusIcon, statusText, progress };
};
