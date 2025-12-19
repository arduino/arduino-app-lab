import clsx from 'clsx';

import { CopyToClipboard } from '../essential/copy-to-clipboard';
import { XXSmall } from '../typography';
import styles from './code-block.module.scss';
import CodeBlockElement from './CodeBlockElement';

interface CodeBlockProps {
  code: string;
  onCopyCode?: (code: string) => void;
  classes?: { container: string };
}

const CodeBlock: React.FC<CodeBlockProps> = (props: CodeBlockProps) => {
  const { code, onCopyCode, classes } = props;

  return (
    <div className={clsx(styles['code-block-space'], classes?.container)}>
      <CodeBlockElement
        classes={{ container: styles['code-block-container'] }}
        code={code}
      />
      <CopyToClipboard
        text={code}
        classes={{ container: styles['code-block-copy-button'] }}
        onClick={onCopyCode}
      >
        <XXSmall className={styles['code-block-copy-button-text']}>
          Copy Code
        </XXSmall>
      </CopyToClipboard>
    </div>
  );
};

export default CodeBlock;
