import { WifiWarning } from '@cloud-editor-mono/images/assets/icons';
import { Wifi } from '@cloud-editor-mono/images/assets/icons';

import {
  Button,
  ButtonSize,
  ButtonType,
} from '../../../../components-by-app/app-lab';
import { useI18n } from '../../../../i18n/useI18n';
import { XSmall } from '../../../../typography';
import Item from '../../../item/Item';
import { networkMessages } from '../../../messages';
import { NetworkItem } from '../../../settings.type';
import styles from './networks-list.module.scss';
interface NetworksListProps {
  networkList: NetworkItem[];
  onSelectNetwork: (network: NetworkItem) => void;
  onManualNetworkSetup: () => void;
}

const NetworksList: React.FC<NetworksListProps> = (
  props: NetworksListProps,
) => {
  const { networkList, onManualNetworkSetup, onSelectNetwork } = props;

  const { formatMessage } = useI18n();

  const renderNoAvailableNetworks = (): JSX.Element => (
    <div className={styles['no-networks']}>
      <WifiWarning />
      <XSmall>{formatMessage(networkMessages.noNetworksWarning)}</XSmall>
      <Button
        type={ButtonType.Tertiary}
        size={ButtonSize.XSmall}
        onClick={onManualNetworkSetup}
      >
        {formatMessage(networkMessages.addNetworkManually)}
      </Button>
    </div>
  );

  return networkList && networkList.length > 0 ? (
    <div className={styles['networks-list-container']}>
      <ul className={styles['networks-list']}>
        {networkList.map((network, index) => (
          <Item
            key={index}
            title={network}
            onClick={(): void => onSelectNetwork(network)}
            classes={{
              container: styles['item'],
            }}
            Icon={<Wifi />}
          />
        ))}
      </ul>
      <Button
        type={ButtonType.Tertiary}
        size={ButtonSize.XSmall}
        uppercase={true}
        onClick={onManualNetworkSetup}
      >
        {formatMessage(networkMessages.setupManualNetwork)}
      </Button>
    </div>
  ) : (
    renderNoAvailableNetworks()
  );
};

export default NetworksList;
