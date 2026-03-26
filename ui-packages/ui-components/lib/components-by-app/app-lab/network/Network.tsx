import {
  Button,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { AppLabDialog } from '../../../dialogs';
import { ButtonSize, ButtonType } from '../../../essential/app-lab-button';
import { skipNetworkMessages } from './messages';
import styles from './network.module.scss';
import {
  NetworkCredentials,
  NetworkItem,
  SecurityProtocols,
  UseNetworkLogic,
} from './network.type';
import ConnectToNetwork from './sub-components/ConnectToNetwork';
import Item from './sub-components/Item';
import NetworksList from './sub-components/NetworksList';
import Scanning from './sub-components/Scanning';

interface NetworkProps {
  logic: ReturnType<UseNetworkLogic> & {
    onSkipNetworkSetup?: () => void;
    draftNetworkCredentials?: NetworkCredentials;
    setDraftNetworkCredentials?: (v: NetworkCredentials) => void;
  };
  isSetupFlow?: boolean;
  unlockAutoFlow?: () => void;
  handleChange?: (value: {
    isValid: boolean;
    isLoading: boolean;
    isSuccess?: boolean;
  }) => void;
  classes?: { container?: string; button?: string };
}

const Network = forwardRef((props: NetworkProps, ref) => {
  const { logic, isSetupFlow, unlockAutoFlow, handleChange } = props;

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
    onSkipNetworkSetup,
  } = logic;

  const { formatMessage } = useI18n();

  const initialCredentials: NetworkCredentials =
    logic.draftNetworkCredentials ?? {
      name: '',
      password: '',
      security: SecurityProtocols.WPA2,
    };

  const [networkCredentials, setNetworkCredentials] =
    useState<NetworkCredentials>(initialCredentials);

  const [skipModalOpen, setSkipModalOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    confirm: (): void => connectToWifiNetwork(networkCredentials),
    skip: (): void => setSkipModalOpen(true),
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

    const next = {
      name: '',
      password: '',
      security: SecurityProtocols.WPA2,
    };

    setNetworkCredentials(next);
    logic.setDraftNetworkCredentials?.(next);

    scanNetworkList();
  }, [scanNetworkList, setManualNetworkSetup, setSelectedNetwork, logic]);

  const skipFooter = useMemo(
    () => (
      <>
        <Button
          type={ButtonType.Secondary}
          size={ButtonSize.Large}
          onClick={(): void => {
            setSkipModalOpen(false);
            onSkipNetworkSetup?.();
          }}
        >
          {formatMessage(skipNetworkMessages.skipButton)}
        </Button>

        <Button
          type={ButtonType.Primary}
          size={ButtonSize.Large}
          onClick={(): void => setSkipModalOpen(false)}
        >
          {formatMessage(skipNetworkMessages.connectButton)}
        </Button>
      </>
    ),
    [formatMessage, onSkipNetworkSetup],
  );

  return (
    <div className={styles['network']}>
      <AppLabDialog
        open={skipModalOpen}
        onOpenChange={setSkipModalOpen}
        title={formatMessage(skipNetworkMessages.title)}
        footer={skipFooter}
        classes={{
          body: styles['skip-modal-body'],
        }}
      >
        <div className={styles['skip-modal-inner']}>
          <h2 className={styles['skip-modal-title']}>
            {formatMessage(skipNetworkMessages.subtitle)}
          </h2>

          <p className={styles['skip-modal-subtitle']}>
            {formatMessage(skipNetworkMessages.description)}
          </p>

          <ul className={styles['skip-modal-list']}>
            <li>{formatMessage(skipNetworkMessages.descriptionListItem1)}</li>
            <li>{formatMessage(skipNetworkMessages.descriptionListItem2)}</li>
            <li>{formatMessage(skipNetworkMessages.descriptionListItem3)}</li>
            <li>{formatMessage(skipNetworkMessages.descriptionListItem4)}</li>
          </ul>
        </div>
      </AppLabDialog>

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
          unlockAutoFlow={unlockAutoFlow}
          onChangeCredentials={(credentials: NetworkCredentials): void => {
            setNetworkCredentials(credentials);
            logic.setDraftNetworkCredentials?.(credentials);
          }}
        />
      ) : (
        <>
          <Scanning
            networkList={networkList}
            isScanning={isScanning}
            scanNetworkList={scanNetworkList}
          />
          {!isScanning ? (
            <NetworksList
              networkList={networkList}
              onSelectNetwork={(network: NetworkItem): void => {
                setSelectedNetwork(network);

                const next = {
                  ...networkCredentials,
                  name: network,
                };

                setNetworkCredentials(next);
                logic.setDraftNetworkCredentials?.(next);

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
