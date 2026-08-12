import {
  IconNavigationMenuMoreHorizontal,
  IconOperationDeleteNormal,
  IconOperationEditPenNormal,
  IconOperationPinNormal,
} from '@arduino/react-icons';
import {
  DropdownMenuButton,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Key } from 'react';

import { messages } from '../../messages';
import styles from './session-actions-menu.module.scss';

export interface SessionActionsMenuProps {
  pinned?: boolean;
  onRename: VoidFunction;
  onPin: VoidFunction;
  onDelete: VoidFunction;
}

export const SessionActionsMenu = ({
  pinned,
  onRename,
  onPin,
  onDelete,
}: SessionActionsMenuProps): JSX.Element => {
  const { formatMessage } = useI18n();

  return (
    <DropdownMenuButton
      title={formatMessage(messages.sessionActionsTooltip)}
      sections={[
        {
          name: 'session-actions',
          items: [
            {
              id: 'rename',
              label: formatMessage(messages.sessionsRename),
              labelPrefix: <IconOperationEditPenNormal />,
            },
            {
              id: 'pin',
              label: formatMessage(
                pinned ? messages.sessionsUnpin : messages.sessionsPin,
              ),
              labelPrefix: <IconOperationPinNormal />,
            },
            {
              id: 'delete',
              label: formatMessage(messages.sessionsDelete),
              labelPrefix: <IconOperationDeleteNormal />,
              itemClassName: styles['delete-item'],
            },
          ],
        },
      ]}
      onAction={(key: Key): void => {
        if (key === 'rename') {
          onRename();
        } else if (key === 'pin') {
          onPin();
        } else {
          onDelete();
        }
      }}
      useStaticPosition={false}
      buttonChildren={<IconNavigationMenuMoreHorizontal />}
      classes={{
        dropdownMenuButtonWrapper: styles['menu-button-wrapper'],
        dropdownMenuButton: styles['menu-button'],
        dropdownMenu: styles['menu'],
        dropdownMenuItem: clsx(styles['menu-item']),
      }}
    />
  );
};
