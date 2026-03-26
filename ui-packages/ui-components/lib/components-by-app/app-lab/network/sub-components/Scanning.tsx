import {
  Button,
  ProgressBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { ButtonSize, ButtonType } from '../../../../essential/app-lab-button';
import { Small, useI18n, XSmall, XXSmall } from '../../../shared';
import { networkMessages } from '../messages';
import { NetworkItem } from '../network.type';
import styles from './scanning.module.scss';

interface ScanningProps {
  networkList: NetworkItem[];
  isScanning: boolean;
  scanNetworkList: () => void;
}

const Scanning: React.FC<ScanningProps> = (props: ScanningProps) => {
  const { networkList, isScanning, scanNetworkList } = props;

  const { formatMessage } = useI18n();

  return (
    <div className={styles['scanning']}>
      <div className={styles['content']}>
        {networkList?.length === 0 && !isScanning ? (
          <XSmall>{formatMessage(networkMessages.noAvailableNetworks)}</XSmall>
        ) : (
          <Small className={styles['title']}>
            {formatMessage(networkMessages.scanningForNetworks)}
            <XXSmall>{formatMessage(networkMessages.chooseNetwork)}</XXSmall>
          </Small>
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
      {isScanning && (
        <ProgressBar
          active={isScanning}
          classes={{ progressBar: styles['progress-bar'] }}
        />
      )}
    </div>
  );
};

export default Scanning;
