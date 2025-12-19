import { ReactElement } from 'react';
import { type CodeProps } from 'react-markdown/lib/ast-to-react';

import CodeBlockElement from '../../../code-block/CodeBlockElement';
import styles from '../../markdown-reader.module.scss';

export const MarkdownReaderTagCode = ({
  inline,
  children,
  className,
  ...props
}: CodeProps): ReactElement => {
  if (inline) {
    return (
      <code className={styles['inline-code']} {...props}>
        {children}
      </code>
    );
  }

  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : undefined;

  return (
    <code {...props}>
      <CodeBlockElement code={children[0] as string} language={language} />
    </code>
  );
};
