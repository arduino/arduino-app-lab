import { Checkmark, Copy } from '@cloud-editor-mono/images/assets/icons';
import React, { useCallback, useState } from 'react';

import { useIsTruncated } from '../common/hooks/useIsTruncated';
import { useTooltip } from '../components-by-app/app-lab/essential/tooltip';
import { useI18n } from '../i18n/useI18n';
import styles from './error-banner.module.scss';
import { messages } from './messages';

export interface ErrorBannerProps {
  message: string;
  onCopy?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);
  const { formatMessage } = useI18n();

  const { ref: messageRef, isTruncated } =
    useIsTruncated<HTMLSpanElement>(message);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: message,
  });

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      onCopy?.();

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [message, onCopy]);

  return (
    <div className={styles['error-banner']}>
      <div
        {...tooltipProps}
        aria-describedby={
          isTruncated ? tooltipProps['aria-describedby'] : undefined
        }
        className={styles['tooltip-trigger']}
      >
        <span className={styles['error-label']}>
          {formatMessage(messages.label)}
        </span>
        <span ref={messageRef} className={styles['error-message']}>
          {message}
        </span>
        {isTruncated && renderTooltip(styles['error-tooltip'])}
      </div>
      <button
        className={styles['copy-button']}
        onClick={handleCopy}
        aria-label={formatMessage(messages.copyMessage)}
        type="button"
      >
        {copied ? <Checkmark /> : <Copy />}
      </button>
    </div>
  );
};
