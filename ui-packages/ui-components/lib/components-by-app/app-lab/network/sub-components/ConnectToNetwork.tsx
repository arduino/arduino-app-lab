import {
  CaretDown,
  Error,
  Success,
  TriangleSharp,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonSize,
  ButtonType,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Key, useCallback, useRef, useState } from 'react';

import { DropdownMenuButton } from '../../../../essential/dropdown-menu';
import { Input, InputStyle } from '../../../../essential/input';
import { useI18n, XXSmall } from '../../../shared';
import setupStyles from '../../setup/setup.module.scss';
import { networkMessages } from '../messages';
import { NetworkCredentials, SecurityProtocols } from '../network.type';
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
  } = props;

  const { formatMessage } = useI18n();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

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
          disabled={isConnecting}
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
          <div
            className={clsx(styles['manual-network-setup'])}
            role="button"
            tabIndex={0}
            onClick={(): void => setOpen((prev) => !prev)}
            onKeyUp={(): void => setOpen((prev) => !prev)}
          >
            <Input
              inputStyle={InputStyle.AppLab}
              id="network-security"
              type="text"
              readOnly
              name={formatMessage(networkMessages.networkSecurity)}
              value={networkCredentials.security}
              disabled={isConnecting}
              onClick={(): void => setOpen((prev) => !prev)}
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
                isOpen={open}
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
                buttonChildren={
                  <CaretDown onClick={(): void => setOpen((prev) => !prev)} />
                }
              />
            ) : null}
          </div>
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
            <XXSmall>{formatMessage(networkMessages.networkError)}</XXSmall>
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
                <Error /> {formatMessage(networkMessages.networkError)}
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
          type={ButtonType.Tertiary}
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
