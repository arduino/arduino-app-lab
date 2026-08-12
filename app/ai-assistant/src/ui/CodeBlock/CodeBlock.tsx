import { Checkmark, FileCopy } from '@cloud-editor-mono/images/assets/icons';
import {
  ButtonAppearance,
  ButtonVariant,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useState } from 'react';

import { Button } from '../Button/Button';
import styles from './code-block.module.scss';

interface CodeBlockProps {
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied ? Checkmark : FileCopy;

  return (
    <div className={styles['code-block']}>
      <div className={styles['copy-action']}>
        <Button
          variant={ButtonVariant.Tertiary}
          appearance={ButtonAppearance.LowContrast}
          size="small"
          onClick={(): void => void copy()}
        >
          <Icon className={styles['copy-icon']} />
        </Button>
      </div>
      <pre className={styles['code-pre']}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
