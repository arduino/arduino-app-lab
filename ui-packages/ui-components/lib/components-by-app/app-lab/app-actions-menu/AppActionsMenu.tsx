import { Plus, UploadLight } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { ButtonHTMLAttributes, Key, ReactNode, RefObject } from 'react';

import { DropdownMenuButton } from '../../../essential/dropdown-menu';
import { useI18n } from '../../../i18n/useI18n';
import { useTooltip } from '../essential/tooltip';
import styles from './app-actions-menu.module.scss';
import { messages } from './messages';

type TriggerRenderer = (
  props: ButtonHTMLAttributes<HTMLButtonElement>,
  ref: RefObject<HTMLButtonElement | null>,
  isOpen?: boolean,
) => ReactNode;

export interface AppActionsMenuProps {
  onCreateApp: () => void;
  onImportApp: () => void;
  // the trigger; each caller supplies its own (icon in the sidebar, full button in the list)
  buttonChildren: ReactNode | TriggerRenderer;
  useStaticPosition?: boolean;
  title?: string;
  onOpen?: (isOpen: boolean) => void;
  classes?: {
    dropdownMenuButtonWrapper?: string;
    dropdownMenu?: string;
    dropdownMenuItem?: string;
  };
}

// Shared Create New App / Import App dropdown, used by both the app list top bar
// and the nav sidebar's Apps "+", so the two entry points stay identical.
export const AppActionsMenu = ({
  onCreateApp,
  onImportApp,
  buttonChildren,
  useStaticPosition = false,
  title,
  onOpen,
  classes,
}: AppActionsMenuProps): JSX.Element => {
  const { formatMessage } = useI18n();

  const {
    props: tooltipProps,
    renderTooltip,
    setShowTooltip,
  } = useTooltip({
    content: title,
    timeout: 0,
    renderDelay: 500,
  });

  return (
    <div {...tooltipProps} className={styles['tooltip-trigger']}>
      <DropdownMenuButton
        onOpen={(isOpen: boolean): void => {
          onOpen?.(isOpen);
          setShowTooltip(false);
        }}
        sections={[
          {
            name: 'app-actions',
            items: [
              {
                id: 'create-app',
                label: formatMessage(messages.createNewApp),
                labelPrefix: <Plus />,
              },
              {
                id: 'import-app',
                label: formatMessage(messages.importApp),
                labelPrefix: <UploadLight />,
              },
            ],
          },
        ]}
        onAction={(key: Key): void =>
          key === 'create-app' ? onCreateApp() : onImportApp()
        }
        useStaticPosition={useStaticPosition}
        buttonChildren={buttonChildren}
        classes={{
          dropdownMenu: clsx(styles['menu'], classes?.dropdownMenu),
          dropdownMenuItem: clsx(
            styles['menu-item'],
            classes?.dropdownMenuItem,
          ),
          dropdownMenuButtonWrapper: classes?.dropdownMenuButtonWrapper,
        }}
      />
      {title ? renderTooltip() : null}
    </div>
  );
};
