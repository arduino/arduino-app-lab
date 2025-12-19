import clsx from 'clsx';

import { CopyToClipboard } from '../essential/copy-to-clipboard';
import { XXSmall } from '../typography';
import styles from './code-diff-block.module.scss';
import CodeDiffBlockElement from './CodeDiffBlockElement';

interface CodeDiffBlockProps {
  originalCode: string;
  modifiedCode: string;
  changes: string;
  startingLine: number;
  onCopyCode?: (code: string) => void;
}

const CodeDiffBlock: React.FC<CodeDiffBlockProps> = (
  props: CodeDiffBlockProps,
) => {
  const { originalCode, modifiedCode, startingLine, onCopyCode, changes } =
    props;

  return (
    <div className={clsx(styles['code-diff-block-space'])}>
      <CodeDiffBlockElement
        classes={{ container: styles['code-diff-block-container'] }}
        originalCode={originalCode}
        modifiedCode={modifiedCode}
        startingLine={startingLine}
      />
      <CopyToClipboard
        text={changes}
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

export default CodeDiffBlock;
