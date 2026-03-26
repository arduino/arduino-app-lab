import { Checkmark, FileCopy } from '@cloud-editor-mono/images/assets/icons';
import { JSXElementConstructor, ReactElement, useState } from 'react';
import { ElementContent } from 'react-markdown/lib/ast-to-react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

import { useI18n } from '../../../../../i18n/useI18n';
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
        setTimeout(() => {
          setCopied(false);
        }, 3000);
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
          {copied ? (
            <Checkmark />
          ) : (
            <button className={styles['copy-button']} onClick={handleCopy}>
              <FileCopy />
            </button>
          )}
        </div>
        <div>{children}</div>
      </pre>
    );
  };
  return TagPreComponent;
};
