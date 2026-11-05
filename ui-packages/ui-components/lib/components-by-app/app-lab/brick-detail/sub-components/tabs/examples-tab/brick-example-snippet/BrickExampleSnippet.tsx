import { ArrowUpRight } from '@cloud-editor-mono/images/assets/icons';
import { useNavigate } from '@tanstack/react-router';
import clsx from 'clsx';

import { useI18n } from '../../../../../../../i18n/useI18n';
import { XXSmall } from '../../../../../../../typography';
import {
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../../../../../essential/button';
import { useTooltip } from '../../../../../essential/tooltip';
import MarkdownReader from '../../../../../markdown-reader/MarkdownReader';
import { messages } from '../../../../messages';
import styles from './brick-example-snippet.module.scss';

export interface BrickExampleSnippetProps {
  title: string;
  exampleId: string;
  content: string;
  onOpenExternalLink?: (url: string) => void;
  hideHeader?: boolean;
  isCurrentExample?: boolean;
}

export const BrickExampleSnippet: React.FC<BrickExampleSnippetProps> = ({
  title,
  exampleId,
  content,
  onOpenExternalLink,
  hideHeader = false,
  isCurrentExample = false,
}: BrickExampleSnippetProps) => {
  const { formatMessage } = useI18n();
  const navigate = useNavigate();

  const { props: titleTooltipProps, renderTooltip: renderTitleTooltip } =
    useTooltip({ content: title });

  return (
    <div
      className={clsx(styles['snippet'], !hideHeader && styles['with-header'])}
    >
      {!hideHeader && (
        <div className={styles['header']}>
          <div {...titleTooltipProps} className={styles['title-wrapper']}>
            <XXSmall bold className={styles['title']}>
              {title}
            </XXSmall>
            {renderTitleTooltip()}
          </div>
          {!isCurrentExample && (
            <Button
              variant={ButtonVariant.Tertiary}
              appearance={ButtonAppearance.Action}
              size={ButtonSize.XXSmall}
              Icon={ArrowUpRight}
              onClick={(): void => {
                void navigate({ to: `/examples/${exampleId}` });
              }}
            >
              {formatMessage(messages.seeExample)}
            </Button>
          )}
        </div>
      )}
      <MarkdownReader
        content={content}
        onOpenExternalLink={onOpenExternalLink}
      />
    </div>
  );
};
