import {
  HardwareCpu,
  HardwareNpu,
  HardwareRam,
  HardwareStorage,
  Stats,
} from '@cloud-editor-mono/images/assets/icons';
import {
  SystemResources,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { forwardRef } from 'react';

import { messages } from '../../messages';
import Panel from '../panel/Panel';
import styles from './system-panel.module.scss';

interface SystemPanelProps {
  systemResources: SystemResources;
  triggerRef?: React.RefObject<HTMLElement>;
}
const SystemPanel = forwardRef<HTMLDivElement, SystemPanelProps>(
  ({ systemResources, triggerRef }, ref) => {
    const { formatMessage } = useI18n();

    return (
      <Panel
        ref={ref}
        triggerRef={triggerRef}
        title={formatMessage(messages.systemStats)}
        icon={<Stats />}
        classes={{
          menuContent: styles['system-stats'],
        }}
      >
        {systemResources.root?.label ? (
          <span
            className={clsx(
              styles['system-stat'],
              styles[systemResources.root?.state || 'default'],
            )}
          >
            <HardwareStorage />
            {systemResources.root?.label}
          </span>
        ) : null}

        {systemResources.user?.label ? (
          <span
            className={clsx(
              styles['system-stat'],
              styles[systemResources.user?.state || 'default'],
            )}
          >
            <HardwareStorage />
            {systemResources.user?.label}
          </span>
        ) : null}

        {systemResources.ram ? (
          <span
            className={clsx(
              styles['system-stat'],
              styles[systemResources.ram?.state || 'default'],
            )}
          >
            <HardwareRam />
            {systemResources.ram?.label}
          </span>
        ) : null}

        {systemResources.npu?.label ? (
          <span
            className={clsx(
              styles['system-stat'],
              styles[systemResources.npu?.state || 'default'],
            )}
          >
            <HardwareNpu />
            {systemResources.npu?.label}
          </span>
        ) : null}

        {systemResources.cpu ? (
          <span
            className={clsx(
              styles['system-stat'],
              styles[systemResources.cpu?.state || 'default'],
            )}
          >
            <HardwareCpu />
            {systemResources.cpu?.label}
          </span>
        ) : null}
      </Panel>
    );
  },
);
SystemPanel.displayName = 'SystemPanel';

export default SystemPanel;
