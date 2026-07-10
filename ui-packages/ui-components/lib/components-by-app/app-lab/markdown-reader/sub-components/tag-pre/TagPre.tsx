import { Checkmark, FileCopy } from '@cloud-editor-mono/images/assets/icons';
import { JSXElementConstructor, ReactElement, useState } from 'react';
import { ElementContent } from 'react-markdown/lib/ast-to-react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

import { useI18n } from '../../../../../i18n/useI18n';
import { useTooltip } from '../../../../../tooltip';
import { XXSmall } from '../../../../../typography';
import styles from '../../markdown-reader.module.scss';
import { messages } from '../../messages';

export const MarkdownReaderTagPre = (
  onCopyCode?: () => void,
): JSXElementConstructor<ReactMarkdownProps> => {
  const TagPreComponent = ({
    children,
    node,
  }: ReactMarkdownProps): ReactElement => {
    const [copied, setCopied] = useState(false);
    const { formatMessage } = useI18n();
    const {
      props: {
        onPress: onTooltipPress,
        ref: tooltipRef,
        'aria-describedby': ariaDescribedby,
      },
      renderTooltip,
    } = useTooltip({
      content: 'Copied!',
      timeout: 2000,
      triggerType: 'click',
      tooltipType: 'title',
    });

    const findText = (nodes: ElementContent[]): string => {
      for (const node of nodes) {
        if (node.type === 'element') {
          return findText(node.children);
        }
        return node.value;
      }
      return '';
    };
    const code = findText(node.children).trim();

    const handleCopy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        onCopyCode?.();
        onTooltipPress?.();
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    };

    return (
      <pre {...node.properties}>
        <div className={styles['copy-container']}>
          <XXSmall className={styles['copy-label']}>
            {formatMessage(messages.copyLabel)}
          </XXSmall>
          <div className={styles['copy-button-wrapper']} ref={tooltipRef}>
            <button
              className={styles['copy-button']}
              onClick={handleCopy}
              disabled={copied}
              aria-describedby={ariaDescribedby}
            >
              {copied ? <Checkmark /> : <FileCopy />}
            </button>
            {renderTooltip(styles['copy-tooltip'])}
          </div>
        </div>
        <div>{children}</div>
      </pre>
    );
  };
  return TagPreComponent;
};
