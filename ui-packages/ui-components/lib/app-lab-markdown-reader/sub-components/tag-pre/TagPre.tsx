import { Checkmark, FileCopy } from '@cloud-editor-mono/images/assets/icons';
import { ReactElement, useState } from 'react';
import { ElementContent } from 'react-markdown/lib/ast-to-react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

import { useI18n } from '../../../i18n/useI18n';
import { XXSmall } from '../../../typography';
import styles from '../../markdown-reader.module.scss';
import { messages } from '../../messages';

export const MarkdownReaderTagPre = ({
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

  const handleCopy = (): void => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 3000);
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
