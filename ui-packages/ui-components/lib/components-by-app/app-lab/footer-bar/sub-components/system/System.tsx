import { Stats } from '@cloud-editor-mono/images/assets/icons';
import {
  useI18n,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { SystemResources } from '../../FooterBar.type';
import { messages } from '../../messages';
import SystemPanel from '../system-panel/SystemPanel';
import styles from './system.module.scss';

interface SystemProps {
  systemResources: SystemResources;
}

export const System: React.FC<SystemProps> = ({
  systemResources,
}: SystemProps) => {
  const [isMenuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLDivElement>(null);

  const { formatMessage } = useI18n();

  // This effect handles clicks outside of the menu
  useEffect(() => {
    // Only add listener if menu is visible
    if (!isMenuVisible) return;
    function handleClickOutside(event: MouseEvent): void {
      // If the click is outside the menuRef, close the menu
      if (
        menuRef.current &&
        menuTriggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !menuTriggerRef.current.contains(event.target as Node)
      ) {
        setMenuVisible(false);
      }
    }
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    // Unbind the event listener on clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuVisible]); // Re-run effect only if isMenuVisible changes

  function clickHandlerNotifications(): void {
    setMenuVisible(!isMenuVisible);
  }

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.systemStats),
    direction: 'up',
    timeout: 0,
  });

  return (
    <div
      ref={menuTriggerRef}
      role="button"
      tabIndex={0}
      className={styles['system-container']}
      onClick={clickHandlerNotifications}
      onKeyUp={clickHandlerNotifications}
    >
      <div
        className={clsx(styles['system-icon-container'], {
          [styles['active']]: isMenuVisible,
        })}
        {...tooltipProps}
      >
        <Stats />
        {renderTooltip(styles['tooltip-content--label'])}
      </div>
      {isMenuVisible && (
        <SystemPanel
          ref={menuRef}
          triggerRef={menuTriggerRef}
          systemResources={systemResources}
        />
      )}
    </div>
  );
};
