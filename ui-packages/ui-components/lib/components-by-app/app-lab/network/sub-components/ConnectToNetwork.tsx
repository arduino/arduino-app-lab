import {
  Error,
  Success,
  TriangleSharp,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonSize,
  ButtonVariant,
  Select,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Key, useCallback, useRef } from 'react';

import { Input, InputStyle } from '../../../../essential/input';
import { useI18n, XXSmall } from '../../../shared';
import setupStyles from '../../setup/setup.module.scss';
import { networkMessages } from '../messages';
import {
  NetworkCredentials,
  SecurityProtocols,
  WiFiConnectionErrorCode,
} from '../network.type';
import { securityProtocols } from '../networkSpec';
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
  unlockAutoFlow?: () => void;
  onChangeCredentials: (credentials: NetworkCredentials) => void;
  errorCode?: WiFiConnectionErrorCode;
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
    unlockAutoFlow,
    onChangeCredentials,
    errorCode,
  } = props;

  const { formatMessage } = useI18n();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const errorMessageDescriptor =
    errorCode === WiFiConnectionErrorCode.IncorrectPassword
      ? networkMessages.incorrectPassword
      : networkMessages.networkError;

  const handleNetworkNameEnter = useCallback((): void => {
    passwordInputRef.current?.focus();
  }, []);

  return (
    <div className={styles['connect-to-network']}>
      <div className={setupStyles['input-container']}>
        <Input
          inputStyle={InputStyle.AppLab}
          id="network-name"
          type="text"
          name={formatMessage(networkMessages.networkName)}
          value={networkCredentials.name}
          disabled={!manualNetworkSetup || isConnecting}
          onChange={(value): void =>
            onChangeCredentials({
              ...networkCredentials,
              name: value,
            })
          }
          onEnter={handleNetworkNameEnter}
          label={formatMessage(networkMessages.networkName)}
        />
      </div>
      {manualNetworkSetup ? (
        <div className={clsx(setupStyles['input-container'])}>
          <Select
            id="network-security"
            name={formatMessage(networkMessages.networkSecurity)}
            label={formatMessage(networkMessages.networkSecurity)}
            value={networkCredentials.security}
            disabled={isConnecting}
            sections={securityProtocols}
            onChange={(key: Key): void =>
              onChangeCredentials({
                ...networkCredentials,
                security: key as SecurityProtocols,
              })
            }
            classes={{
              container: styles['select-container'],
              open: styles['select-container--open'],
            }}
          />
        </div>
      ) : null}
      <div className={setupStyles['input-container']}>
        <Input
          id="network-password"
          ref={passwordInputRef}
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
              if (isSetupFlow && unlockAutoFlow) {
                unlockAutoFlow();
              }
              connectToWifiNetwork(networkCredentials);
            }
          }}
          label={formatMessage(networkMessages.networkPassword)}
          sensitive
        />
        {!isSetupFlow && isError && (
          <div className={styles['error-message']}>
            <TriangleSharp />
            <XXSmall>{formatMessage(errorMessageDescriptor)}</XXSmall>
          </div>
        )}
        {isSetupFlow && (
          <XXSmall
            bold
            className={clsx(setupStyles['message'], {
              [setupStyles['error']]: isError,
              [setupStyles['success']]: isSuccess,
            })}
          >
            {isError ? (
              <>
                <Error /> {formatMessage(errorMessageDescriptor)}
              </>
            ) : isSuccess ? (
              <>
                <Success /> {formatMessage(networkMessages.networkConnected)}
              </>
            ) : null}
          </XXSmall>
        )}
      </div>
      <div className={styles['buttons-container']}>
        <Button
          variant={ButtonVariant.Tertiary}
          size={ButtonSize.XSmall}
          onClick={onChangeNetwork}
          uppercase={true}
        >
          {formatMessage(networkMessages.changeNetwork)}
        </Button>
      </div>
    </div>
  );
};

export default ConnectToNetwork;
