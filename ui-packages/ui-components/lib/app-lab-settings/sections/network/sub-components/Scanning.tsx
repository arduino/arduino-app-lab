import {
  Button,
  ButtonSize,
  ButtonType,
} from '../../../../components-by-app/app-lab';
import { ProgressBar } from '../../../../essential/progress-bar';
import { useI18n } from '../../../../i18n/useI18n';
import { XSmall, XXSmall } from '../../../../typography';
import { networkMessages } from '../../../messages';
import { NetworkItem } from '../../../settings.type';
import styles from './scanning.module.scss';

interface ScanningProps {
  networkList: NetworkItem[];
  isScanning: boolean;
  scanNetworkList: () => void;
  onManualNetworkSetup: () => void;
}

const Scanning: React.FC<ScanningProps> = (props: ScanningProps) => {
  const { networkList, isScanning, scanNetworkList, onManualNetworkSetup } =
    props;

  const { formatMessage } = useI18n();

  return (
    <div className={styles['scanning']}>
      <div className={styles['content']}>
        {networkList?.length === 0 && !isScanning ? (
          <XSmall>{formatMessage(networkMessages.noAvailableNetworks)}</XSmall>
        ) : (
          <XSmall className={styles['title']}>
            {formatMessage(networkMessages.scanningForNetworks)}
            <XXSmall>{formatMessage(networkMessages.chooseNetwork)}</XXSmall>
          </XSmall>
        )}
        <Button
          type={ButtonType.Tertiary}
          size={ButtonSize.XSmall}
          onClick={scanNetworkList}
          disabled={isScanning}
        >
          {formatMessage(networkMessages.scanAgain)}
        </Button>
      </div>
      {isScanning ? (
        <>
          <ProgressBar
            active={isScanning}
            classes={{ progressBar: styles['progress-bar'] }}
          />
          <button
            className={styles['add-network']}
            onClick={onManualNetworkSetup}
          >
            <div>{formatMessage(networkMessages.addNetworkManually)}</div>
          </button>
        </>
      ) : null}
    </div>
  );
};

export default Scanning;
