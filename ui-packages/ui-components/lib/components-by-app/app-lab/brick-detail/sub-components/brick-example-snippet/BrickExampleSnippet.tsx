import { ArrowUpRight } from '@cloud-editor-mono/images/assets/icons';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';

import { useI18n } from '../../../../../i18n/useI18n';
import { XXSmall } from '../../../../../typography';
import MarkdownReader from '../../../markdown-reader/MarkdownReader';
import { messages } from '../../messages';
import styles from './brick-example-snippet.module.scss';

export interface BrickExampleSnippetProps {
  title: string;
  exampleId: string;
  content: string;
  onOpenExternalLink?: (url: string) => void;
  hideHeader?: boolean;
}

export const BrickExampleSnippet: React.FC<BrickExampleSnippetProps> = ({
  title,
  exampleId,
  content,
  onOpenExternalLink,
  hideHeader = false,
}: BrickExampleSnippetProps) => {
  const { formatMessage } = useI18n();
  const navigate = useNavigate();

  return (
    <div
      className={clsx(styles['snippet'], !hideHeader && styles['with-header'])}
    >
      {!hideHeader && (
        <div className={styles['header']}>
          <XXSmall bold className={styles['title']}>
            {title}
          </XXSmall>
          <button
            type="button"
            className={styles['see-example-link']}
            onClick={(): void => {
              void navigate({ to: `/examples/${exampleId}` });
            }}
          >
            {formatMessage(messages.seeExample)}
            <ArrowUpRight />
          </button>
        </div>
      )}
      <MarkdownReader
        content={content}
        onOpenExternalLink={onOpenExternalLink}
      />
    </div>
  );
};
