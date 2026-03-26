import { useRef } from 'react';

import {
  Button,
  ButtonSize,
  Network,
  useI18n,
  UseNetworkLogic,
} from '../../../components-by-app/app-lab';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { networkSettingsDialogMessages as messages } from '../messages';

export type NetworkSettingsDialogLogic = ReturnType<UseNetworkLogic> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type NetworkSettingsDialogProps = {
  logic: NetworkSettingsDialogLogic;
};

export const NetworkSettingsDialog: React.FC<NetworkSettingsDialogProps> = ({
  logic,
}: NetworkSettingsDialogProps) => {
  const { formatMessage } = useI18n();

  const { open, onOpenChange, ...networkLogic } = logic;
  const { isScanning, isConnecting, selectedNetwork, manualNetworkSetup } =
    networkLogic;

  const ref = useRef<{
    confirm: () => void;
  }>(null);

  const isLoading = isScanning || Boolean(isConnecting);
  const showFooterConfirmBtn = selectedNetwork || manualNetworkSetup;

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={(): void => ref.current?.confirm()}
      footer={
        <Button
          loading={isLoading}
          size={ButtonSize.Small}
          disabled={
            isLoading || (!logic.selectedNetwork && !logic.manualNetworkSetup)
          }
          isSubmit
        >
          {formatMessage(messages.confirmButton)}
        </Button>
      }
    >
      <Network ref={ref} logic={networkLogic} isSetupFlow={false} />
    </AppLabDialog>
  );
};
