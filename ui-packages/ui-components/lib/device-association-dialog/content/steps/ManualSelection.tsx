import { PluginCables } from '@cloud-editor-mono/images/assets/icons';
import { useContext, useMemo } from 'react';
import { MessageDescriptor } from 'react-intl';

import { useI18n } from '../../../i18n/useI18n';
import { XSmall } from '../../../typography';
import { DeviceAssociationContext } from '../../context/deviceAssociationContext';
import { OnSetUndetectedBoard } from '../../deviceAssociationDialog.type';
import { messages } from '../messages';
import DevicesMoreThanOne from './templates/DevicesMoreThanOne';
import { DevicesListModality } from './templates/devicesMoreThanOne.type';
import styles from './undetected-selection.module.scss';

interface ManualSelectionProps {
  markAssociated: boolean;
  onItemSelect: OnSetUndetectedBoard;
  description: MessageDescriptor;
  noPrompt?: boolean;
  usingWebSerial?: boolean;
}

const ManualSelection: React.FC<ManualSelectionProps> = (
  props: ManualSelectionProps,
) => {
  const {
    markAssociated,
    onItemSelect,
    noPrompt,
    description,
    usingWebSerial,
  } = props;
  const { getDevicesListLogic, detectedDevices, agentIsNotDetected } =
    useContext(DeviceAssociationContext);
  const { formatMessage } = useI18n();

  const { devices, devicesAreLoading } = getDevicesListLogic();

  const renderPluginBoardPrompt = (): JSX.Element => {
    return (
      <div className={styles['plugin-board-prompt']}>
        <PluginCables />
        <XSmall>{formatMessage(messages.pluginBoardPrompt)}</XSmall>
      </div>
    );
  };

  const orderedDevices = useMemo(
    () =>
      usingWebSerial
        ? devices.sort((device) => (device.webSerialSupport ? -1 : 1))
        : devices,
    [usingWebSerial, devices],
  );

  const promptElement =
    !noPrompt && detectedDevices.length === 0 && !agentIsNotDetected
      ? renderPluginBoardPrompt()
      : null;

  if (devicesAreLoading) {
    return (
      <DevicesMoreThanOne
        promptElement={promptElement}
        devices={[]}
        deviceListModality={DevicesListModality.Loading}
        searchable={false}
        markAssociated={false}
        title={formatMessage(messages.selectedTypeTitle)}
        listHelper={formatMessage(description)}
        classes={{ header: styles.header, listHelper: styles['list-helper'] }}
        usingWebSerial={usingWebSerial}
      />
    );
  }

  return (
    <DevicesMoreThanOne
      promptElement={promptElement}
      devices={orderedDevices}
      deviceListModality={DevicesListModality.Undetected}
      searchable={true}
      markAssociated={markAssociated}
      title={formatMessage(messages.selectedTypeTitle)}
      listHelper={formatMessage(description)}
      classes={{ header: styles.header, listHelper: styles['list-helper'] }}
      onItemSelect={onItemSelect}
      usingWebSerial={usingWebSerial}
    />
  );
};

export default ManualSelection;
