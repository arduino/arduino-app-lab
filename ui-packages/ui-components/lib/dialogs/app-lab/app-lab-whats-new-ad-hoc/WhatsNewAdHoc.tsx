import {
  Button,
  ButtonSize,
  ButtonType,
  MarkdownReader,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { XXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { messages } from './messages';
import styles from './whats-new-ad-hoc.module.scss';
import { WhatsNewAdHocProps } from './WhatsNewAdHoc.type';

export const WhatsNewAdHoc: React.FC<WhatsNewAdHocProps> = ({
  logic,
}: WhatsNewAdHocProps) => {
  const { formatMessage } = useI18n();

  const dialogRef = useRef<HTMLDivElement>(null);

  const { open, onClose, releaseNotes } = logic();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent): void {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, open]);

  return releaseNotes ? (
    <AppLabDialog
      open={open}
      closeable={false}
      classes={{
        body: clsx(styles['dialog-body']),
      }}
      ref={dialogRef}
    >
      <div className={styles['update-dialog-header']}>
        <XXSmall className={styles['title']}>
          {formatMessage(messages.title)}
        </XXSmall>
        <Button
          type={ButtonType.Tertiary}
          size={ButtonSize.XSmall}
          onClick={onClose}
        >
          {formatMessage(messages.close)}
        </Button>
      </div>
      <div className={styles['update-dialog-body']}>
        <div className={styles['release-notes']}>
          <img src={releaseNotes.image} alt="Release notes" />
          <div className={styles['notes']}>
            <MarkdownReader content={releaseNotes.content} />
          </div>
        </div>
      </div>
    </AppLabDialog>
  ) : null;
};
