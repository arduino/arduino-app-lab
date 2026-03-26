import { DisableNetworkModeDialog } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useState } from 'react';

import { Loader } from '../../../../essential/loader';
import { ToggleButton } from '../../../../essential/toggle-button';
import { useI18n } from '../../../shared';
import { systemMessages } from '../messages';

export interface DeviceStorageProps {
  disabled?: boolean;
  isNetworkModeEnabled?: boolean;
  isSettingNetworkMode?: boolean;
  setNetworkMode: (enabled: boolean) => void;
}

export const NetworkMode = ({
  disabled,
  isNetworkModeEnabled,
  isSettingNetworkMode,
  setNetworkMode,
}: DeviceStorageProps): JSX.Element => {
  const { formatMessage } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <DisableNetworkModeDialog
        open={open}
        onOpenChange={setOpen}
        confirmAction={(): void => {
          setOpen(false);
          setNetworkMode(false);
        }}
      />
      {isSettingNetworkMode ? (
        <Loader tiny />
      ) : (
        <ToggleButton
          isDisabled={disabled}
          isSelected={isNetworkModeEnabled}
          aria-label={formatMessage(systemMessages.remoteAccess)}
          onChange={(enabled): void =>
            enabled ? setNetworkMode(true) : setOpen(true)
          }
        />
      )}
    </>
  );
};
