import { ArduinoRoundLogo } from '@cloud-editor-mono/images/assets/icons';
import { useContext } from 'react';

import { Button } from '../../../essential/button';
import { useI18n } from '../../../i18n/useI18n';
import { Text, TextSize } from '../../../typography';
import { DeviceAssociationContext } from '../../context/deviceAssociationContext';
import { DeviceAssociationDialogLinks } from '../../deviceAssociationDialog.type';
import { messages } from '../messages';
import DeviceListItem from '../sub-components/devices-list/device-list-item/DeviceListItem';
import DialogContentHeader from '../sub-components/dialog-content-header/DialogContentHeader';
import LabeledDivider from '../sub-components/labeled-divider/LabeledDivider';
import ManualSelectBlock from '../sub-components/manual-select-block/ManualSelectBlock';
import TroubleShootingMessage from '../sub-components/trouble-shooting-message/troubleShootingMessage';
import styles from './detected-none.module.scss';

export enum DetectedNoneReason {
  NoDevices,
  NoAgent,
}

interface DetectedNoneProps {
  onManualSelectChosen: () => void;
}

const DetectedNone: React.FC<DetectedNoneProps> = (
  props: DetectedNoneProps,
) => {
  const { onManualSelectChosen } = props;
  const { agentIsNotDetected, canDownloadAgent, onClickDownloadAgent, links } =
    useContext(DeviceAssociationContext);
  const { formatMessage } = useI18n();

  const reason = agentIsNotDetected
    ? DetectedNoneReason.NoAgent
    : DetectedNoneReason.NoDevices;

  const Image = ((): JSX.Element => {
    switch (reason) {
      case DetectedNoneReason.NoDevices:
        return <DeviceListItem deviceListModality={null} key={'one'} />;
      case DetectedNoneReason.NoAgent:
        return <ArduinoRoundLogo />;
    }
  })();

  const Body = ((): JSX.Element => {
    switch (reason) {
      case DetectedNoneReason.NoDevices:
        return (
          <div className={styles['message']}>
            <TroubleShootingMessage
              troubleShootingUrl={
                links[DeviceAssociationDialogLinks.TroubleShootingDevices]
              }
            />
          </div>
        );
      case DetectedNoneReason.NoAgent:
        return (
          <div className={styles['agent-not-found-message']}>
            <Text
              size={TextSize.XSmall}
              className={styles['agent-not-found-leading-message']}
            >
              {formatMessage(messages.agentNotFoundMessage)}
            </Text>
            {canDownloadAgent ? (
              <Button
                onClick={onClickDownloadAgent}
                classes={{ button: styles['agent-not-found-download-button'] }}
              >
                {formatMessage(messages.agentNotFoundDownload)}
              </Button>
            ) : null}
            <TroubleShootingMessage
              bigger
              troubleShootingUrl={
                links[DeviceAssociationDialogLinks.TroubleshootingAgent]
              }
              messageDescriptor={messages.agentNotFoundTroubleMessage}
            />
          </div>
        );
    }
  })();

  return (
    <div className={styles.body}>
      {Image}
      {reason === DetectedNoneReason.NoAgent ? (
        <DialogContentHeader
          title={formatMessage(messages.agentNotFoundTitle)}
          classes={{ title: styles.title }}
        />
      ) : null}
      {Body}
      <LabeledDivider label={formatMessage(messages.dividerLabel)} />
      <div className={styles['manual-select-block-container']}>
        <ManualSelectBlock onClick={onManualSelectChosen} />
      </div>
    </div>
  );
};

export default DetectedNone;
