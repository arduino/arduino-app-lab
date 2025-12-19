import { TriangleSharp } from '@cloud-editor-mono/images/assets/icons';
import * as Collapsible from '@radix-ui/react-collapsible';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CopyToClipboard } from '../../../essential/copy-to-clipboard';
import styles from './board-update-dialog.module.scss';

type LogsPanelProps = {
  logs: string[];
  defaultOpen?: boolean;
  status?: 'failed' | 'success' | 'pending';
};

export const LogsPanel: React.FC<LogsPanelProps> = ({
  logs,
  defaultOpen = true,
  status,
}: LogsPanelProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleScroll = (): void => {
    const el = panelRef.current;
    if (!el) return;
    const threshold = 50;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    if (isAtBottom && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  const text = useMemo(() => logs.join('\n'), [logs]);

  const title = (): JSX.Element => {
    switch (status) {
      case 'failed':
        return (
          <div className={styles['logs-panel-title--failed']}>
            <TriangleSharp />
            <span>Update failed</span>
          </div>
        );
      case 'pending':
        return (
          <span className={clsx(styles['pending'], styles['logs-panel-title'])}>
            Installing UNO Q Software Updates
          </span>
        );

      case 'success':
        return (
          <span className={clsx(styles['success'], styles['logs-panel-title'])}>
            UNO Q Software Update Complete
          </span>
        );
      default:
        return <span>Logs</span>;
    }
  };

  return (
    <Collapsible.Root
      className={styles['logs-panel']}
      open={open}
      onOpenChange={setOpen}
    >
      <Collapsible.Trigger asChild className={styles['logs-panel-trigger']}>
        <div>
          {title()}
          <div className={styles['logs-panel-actions']}>
            <CopyToClipboard
              text={text}
              classes={{ container: styles['logs-panel-actions--copy'] }}
            />
            <div className={styles['logs-panel-actions--button']}>
              {open ? 'Hide Logs' : 'Show Logs'}
            </div>
          </div>
        </div>
      </Collapsible.Trigger>

      <Collapsible.Content
        ref={panelRef}
        className={clsx(styles['logs-panel-content'], {
          [styles['success']]: status === 'success',
          [styles['pending']]: status === 'pending',
        })}
        onScroll={handleScroll}
      >
        {logs.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
