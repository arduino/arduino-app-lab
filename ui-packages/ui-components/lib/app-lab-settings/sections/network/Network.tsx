import { WifiOff, WifiOn } from '@cloud-editor-mono/images/assets/icons';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

import { UseNetworkLogic } from '../../../components-by-app/app-lab';
import Item from '../../item/Item';
import {
  NetworkCredentials,
  NetworkItem,
  SecurityProtocols,
} from '../../settings.type';
import styles from './network.module.scss';
import ConnectToNetwork from './sub-components/ConnectToNetwork';
import NetworksList from './sub-components/NetworksList';
import Scanning from './sub-components/Scanning';

interface NetworkProps {
  logic: ReturnType<UseNetworkLogic>;
  isSetupFlow?: boolean;
  handleChange?: (value: {
    isValid: boolean;
    isLoading: boolean;
    isSuccess?: boolean;
  }) => void;
  classes?: { container?: string; button?: string };
}

const Network = forwardRef((props: NetworkProps, ref) => {
  const { logic, isSetupFlow, handleChange } = props;

  const {
    networkList,
    isScanning,
    scanNetworkList,
    connectToWifiNetwork,
    isConnected,
    isConnecting,
    connectRequestIsError,
    connectRequestIsSuccess,
    selectedNetwork,
    setSelectedNetwork,
    manualNetworkSetup,
    setManualNetworkSetup,
  } = logic;

  const [networkCredentials, setNetworkCredentials] =
    useState<NetworkCredentials>({
      name: '',
      password: '',
      security: SecurityProtocols.WPA2,
    });

  useImperativeHandle(ref, () => ({
    confirm: (): void => connectToWifiNetwork(networkCredentials),
  }));

  useEffect(() => {
    if (isSetupFlow && handleChange) {
      handleChange({
        isValid: Boolean(networkCredentials.name) && !connectRequestIsError,
        isLoading: isConnecting || isScanning,
        isSuccess: isConnected,
      });
    }
  }, [
    networkCredentials,
    isSetupFlow,
    handleChange,
    selectedNetwork,
    connectRequestIsError,
    isConnecting,
    isScanning,
    isConnected,
  ]);

  const resetNetworkState = useCallback((): void => {
    setSelectedNetwork(undefined);
    setManualNetworkSetup(false);
    setNetworkCredentials({
      name: '',
      password: '',
      security: SecurityProtocols.WPA2,
    });
    scanNetworkList();
  }, [scanNetworkList, setManualNetworkSetup, setSelectedNetwork]);

  return (
    <div className={styles['network']}>
      {!isSetupFlow ? (
        <div className={styles['icon']}>
          {isScanning ? <WifiOff /> : <WifiOn />}
        </div>
      ) : null}
      {selectedNetwork || manualNetworkSetup ? (
        <ConnectToNetwork
          connectToWifiNetwork={connectToWifiNetwork}
          isConnected={isConnected}
          isConnecting={isConnecting}
          isError={connectRequestIsError}
          isSuccess={connectRequestIsSuccess}
          onChangeNetwork={resetNetworkState}
          manualNetworkSetup={manualNetworkSetup}
          isSetupFlow={isSetupFlow}
          networkCredentials={networkCredentials}
          onChangeCredentials={(credentials: NetworkCredentials): void =>
            setNetworkCredentials(credentials)
          }
        />
      ) : (
        <>
          <Scanning
            networkList={networkList}
            isScanning={isScanning}
            scanNetworkList={scanNetworkList}
            onManualNetworkSetup={(): void => setManualNetworkSetup(true)}
          />
          {!isScanning ? (
            <NetworksList
              networkList={networkList}
              onSelectNetwork={(network: NetworkItem): void => {
                setSelectedNetwork(network);
                setNetworkCredentials({
                  ...networkCredentials,
                  name: network,
                });
                setManualNetworkSetup(false);
              }}
              onManualNetworkSetup={(): void => setManualNetworkSetup(true)}
            />
          ) : (
            [...Array(3)].map((_, index) => (
              <Item
                key={index}
                classes={{
                  container: styles['item-placeholder'],
                  content: styles['item-content'],
                  icon: styles['item-icon'],
                }}
              />
            ))
          )}
        </>
      )}
    </div>
  );
});

Network.displayName = 'Network';

export default Network;
