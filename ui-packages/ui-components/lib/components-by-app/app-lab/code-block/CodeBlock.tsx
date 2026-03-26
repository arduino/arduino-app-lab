import { CloseX, OpenInNewTab } from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonType,
  IconButton,
  MarkdownReader,
  TreeNode,
  XSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import CodeBlockElement from '../../../code-block/CodeBlockElement';
import styles from './code-block.module.scss';

interface CodeBlockProps {
  file: TreeNode;
  fileContent: string;
  onClose: () => void;
  onOpenExternal?: () => void;
  onOpenExternalLink?: (url: string) => void;
  classes?: { container: string };
}

const CodeBlock: React.FC<CodeBlockProps> = (props: CodeBlockProps) => {
  const {
    file,
    fileContent,
    onClose,
    onOpenExternal,
    onOpenExternalLink,
    classes,
  } = props;

  return (
    <div className={clsx(styles['container'], classes?.container)}>
      <div className={styles['header']}>
        <XSmall className={styles['title']}>{file.name}</XSmall>
        {onOpenExternal ? (
          <Button
            type={ButtonType.Tertiary}
            Icon={OpenInNewTab}
            iconPosition="right"
            onClick={onOpenExternal}
            classes={{ button: styles['open-external-button'] }}
          >
            {'Open'}
          </Button>
        ) : null}
        <IconButton
          Icon={CloseX}
          onPress={onClose}
          label={'close'}
          classes={{ button: styles['close-button'] }}
        />
      </div>
      {file.name.toLowerCase().endsWith('.md') ? (
        <MarkdownReader
          content={fileContent}
          onOpenExternalLink={onOpenExternalLink}
        />
      ) : file.type === 'file' && file.mimeType.includes('image') ? (
        <img className={styles['image']} alt="" src={fileContent} />
      ) : (
        <CodeBlockElement
          classes={{
            container: styles['code-block'],
          }}
          code={fileContent}
        />
      )}
    </div>
  );
};

export default CodeBlock;
