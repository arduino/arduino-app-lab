import { useTooltip } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import styles from './blocked.module.scss';

export interface BlockedProps {
  // Why the control inside is refused; nothing is wrapped when it is absent.
  reason?: string;
  children: React.ReactNode;
}

// A disabled control gets no hover, and not every engine shows a native title on one: hence a wrapper.
export const Blocked: React.FC<BlockedProps> = ({ reason, children }) => {
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: reason ?? '',
    timeout: 0,
    renderDelay: 300,
  });

  if (!reason) {
    return <>{children}</>;
  }

  return (
    <span {...tooltipProps} className={styles['blocked']}>
      {children}
      {renderTooltip(styles['blocked-tooltip'])}
    </span>
  );
};

export default Blocked;
