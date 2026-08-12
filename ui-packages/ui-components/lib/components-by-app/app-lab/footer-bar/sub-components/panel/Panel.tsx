import { XXSmall } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { forwardRef, PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

import styles from './panel.module.scss';

type PanelProps = PropsWithChildren<{
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement>;
  classes?: {
    menu?: string;
    menuHeader?: string;
    menuHeaderTitle?: string;
    menuContent?: string;
  };
}>;

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ icon, title, action, children, classes, triggerRef }, ref) => (
    <>
      {createPortal(
        <div
          role="menu"
          tabIndex={0}
          ref={ref}
          className={clsx(styles['menu'], classes?.menu)}
          style={{
            right: triggerRef?.current
              ? `${
                  window.innerWidth -
                  triggerRef.current.getBoundingClientRect().right
                }px`
              : undefined,
          }}
          onClick={(e): void => e.stopPropagation()}
          onKeyUp={(e): void => e.stopPropagation()}
        >
          <div className={clsx(styles['menu-header'], classes?.menuHeader)}>
            <div
              className={clsx(
                styles['menu-header-title'],
                classes?.menuHeaderTitle,
              )}
            >
              {icon}
              <XXSmall>{title}</XXSmall>
            </div>
            {action}
          </div>
          <div className={clsx(styles['menu-content'], classes?.menuContent)}>
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  ),
);
Panel.displayName = 'Panel';

export default Panel;
