import {
  CaretDown,
  Error,
  Success,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { Key } from 'react';

import setupStyles from '../../../../app-lab-setup/setup.module.scss';
import {
  Button,
  ButtonSize,
  ButtonType,
} from '../../../../components-by-app/app-lab';
import DropdownMenuButton from '../../../../essential/dropdown-menu/DropdownMenuButton';
import { Input } from '../../../../essential/input';
import { InputStyle } from '../../../../essential/input/input.type';
import { useI18n } from '../../../../i18n/useI18n';
import { XXSmall } from '../../../../typography';
import { networkMessages } from '../../../messages';
import { NetworkCredentials, SecurityProtocols } from '../../../settings.type';
import { securityProtocols } from '../../../settingsSpec';
import styles from './connect-to-network.module.scss';

interface ConnectToNetworkProps {
  connectToWifiNetwork: (credentials: NetworkCredentials) => void;
  isConnected?: boolean;
  isConnecting?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  onChangeNetwork: () => void;
  manualNetworkSetup?: boolean;
  isSetupFlow?: boolean;
  networkCredentials: NetworkCredentials;
  onChangeCredentials: (credentials: NetworkCredentials) => void;
}

const ConnectToNetwork: React.FC<ConnectToNetworkProps> = (
  props: ConnectToNetworkProps,
) => {
  const {
    connectToWifiNetwork,
    isConnecting,
    onChangeNetwork,
    manualNetworkSetup,
    isError,
    isSuccess,
    isSetupFlow,
    networkCredentials,
    onChangeCredentials,
  } = props;

  const { formatMessage } = useI18n();

  return (
    <div className={styles['connect-to-network']}>
      <div className={setupStyles['input-container']}>
        <Input
          inputStyle={InputStyle.AppLab}
          id="network-name"
          type="text"
          name={formatMessage(networkMessages.networkName)}
          value={networkCredentials.name}
          disabled={isConnecting}
          onChange={(value): void =>
            onChangeCredentials({
              ...networkCredentials,
              name: value,
            })
          }
          label={formatMessage(networkMessages.networkName)}
        />
      </div>
      {manualNetworkSetup ? (
        <div className={clsx(setupStyles['input-container'])}>
          <div className={clsx(styles['manual-network-setup'])}>
            <Input
              inputStyle={InputStyle.AppLab}
              id="network-security"
              type="text"
              readOnly
              name={formatMessage(networkMessages.networkSecurity)}
              value={networkCredentials.security}
              disabled={isConnecting}
              onChange={(key: Key): void =>
                onChangeCredentials({
                  ...networkCredentials,
                  security: key as SecurityProtocols,
                })
              }
              label={formatMessage(networkMessages.networkSecurity)}
              classes={{
                input: styles['input'],
              }}
            />
            {!isConnecting ? (
              <DropdownMenuButton
                sections={securityProtocols}
                classes={{
                  dropdownMenuButtonWrapper:
                    styles['dropdown-menu-button-wrapper'],
                  dropdownMenu: styles['dropdown-menu'],
                }}
                onAction={(key: Key): void =>
                  onChangeCredentials({
                    ...networkCredentials,
                    security: key as SecurityProtocols,
                  })
                }
                buttonChildren={<CaretDown />}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={setupStyles['input-container']}>
        <Input
          id="network-password"
          value={networkCredentials.password}
          inputStyle={InputStyle.AppLab}
          disabled={isConnecting}
          onChange={(value): void =>
            onChangeCredentials({
              ...networkCredentials,
              password: value,
            })
          }
          onKeyDown={(e): void => {
            if (e.key === 'Enter') {
              e.preventDefault();
              connectToWifiNetwork(networkCredentials);
            }
          }}
          label={formatMessage(networkMessages.networkPassword)}
          sensitive
        />
        <XXSmall
          bold
          className={clsx(setupStyles['message'], {
            [setupStyles['error']]: isError,
            [setupStyles['success']]: isSuccess,
          })}
        >
          {isError ? (
            <>
              <Error /> {formatMessage(networkMessages.networkError)}
            </>
          ) : isSuccess ? (
            <>
              <Success /> {formatMessage(networkMessages.networkConnected)}
            </>
          ) : null}
        </XXSmall>
      </div>
      <div className={styles['buttons-container']}>
        <Button
          type={ButtonType.Tertiary}
          size={ButtonSize.XSmall}
          onClick={onChangeNetwork}
          uppercase={true}
        >
          {formatMessage(networkMessages.changeNetwork)}
        </Button>
        {!isSetupFlow ? (
          <Button
            type={ButtonType.Tertiary}
            uppercase={true}
            disabled={(isConnecting && !isError) || !networkCredentials.name}
            onClick={(): void => connectToWifiNetwork(networkCredentials)}
          >
            {isConnecting
              ? formatMessage(networkMessages.connectingToNetwork)
              : formatMessage(networkMessages.connectToNetwork)}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default ConnectToNetwork;
