import {
  DisableNetworkModeDialog,
  PasswordDialog,
  UseNetworkModeLogic,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useState } from 'react';

import { useI18n } from '../../../shared';
import { Toggle } from '../../essential/toggle';
import { systemMessages } from '../messages';
import styles from '../settings.module.scss';

export interface DeviceStorageProps {
  disabled?: boolean;
  logic: UseNetworkModeLogic;
}

export const NetworkMode = ({
  disabled,
  logic,
}: DeviceStorageProps): JSX.Element => {
  const { formatMessage } = useI18n();
  const [open, setOpen] = useState(false);

  const { isNetworkModeEnabled, ...passwordLogic } = logic();

  return (
    <>
      <PasswordDialog logic={passwordLogic} />
      <DisableNetworkModeDialog
        open={open}
        onOpenChange={setOpen}
        confirmAction={(): void => {
          setOpen(false);
          passwordLogic.onOpenChange(true);
        }}
      />
      <Toggle
        className={styles['toggle-button']}
        isDisabled={disabled}
        isSelected={isNetworkModeEnabled}
        aria-label={formatMessage(systemMessages.remoteAccess)}
        onChange={(enabled): void =>
          enabled ? passwordLogic.onOpenChange(true) : setOpen(true)
        }
      />
    </>
  );
};
