import { BOARD_FQBN, Config } from '@cloud-editor-mono/common';
import {
  AccountArduinoCloud,
  Board2,
  Download,
  InfoSetup,
  NavigationGroupOutline,
  OperationSort,
  Pencil,
  Reload,
  Sort,
  Success,
  Tools,
  World,
  WorldDisconnected,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Badge,
  BadgeStyle,
  BadgeVariant,
  Banner,
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  ChangePasswordDialog,
  CloudConnectorConnectDialog,
  CloudConnectorDisconnectDialog,
  DropdownMenuButton,
  NetworkSettingsDialog,
  PasswordDialog,
  UnsupportedCarrierDialog,
  XXSmall,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Fragment, useMemo } from 'react';

import { AttachCarrierDialog } from '../../../dialogs/app-lab/attach-carrier-dialog/AttachCarrierDialog';
import { useI18n } from '../../../i18n/useI18n';
import { Toggle } from '../essential/toggle';
import { SettingsSection } from '../settings-section';
import {
  appMessages,
  carrierMessages,
  cloudConnectorMessages,
  deviceMessages,
  networkMessages,
  osMessages,
  settingsMessages,
  systemMessages,
} from './messages';
import styles from './settings.module.scss';
import { SettingsProps } from './settings.type';
import { CarrierOption } from './subcomponents/CarrierOption';
import { DeviceHeader } from './subcomponents/DeviceHeader';
import { DeviceSerialNumber } from './subcomponents/DeviceSerialNumber';
import { DeviceStorage } from './subcomponents/DeviceStorage';
import { NetworkMode } from './subcomponents/NetworkMode';

export const Settings: React.FC<SettingsProps> = ({
  settingsLogic,
  agentSection,
}: SettingsProps) => {
  const { formatMessage } = useI18n();

  // Documentation URLs
  const ARDUINO_DOCS_BASE_URL = 'https://docs.arduino.cc/software/app-lab';
  const DOCUMENTATION_URL = `${ARDUINO_DOCS_BASE_URL}/`;
  const RELEASE_NOTES_URL = `${ARDUINO_DOCS_BASE_URL}/getting-started/release-notes/`;
  const ARDUINO_CLOUD_URL = 'https://docs.arduino.cc/arduino-cloud/';

  const {
    cloudConnectorSettingsLogic,
    boardSettingsLogic,
    carrierSettingsLogic,
    networkModeLogic,
    networkSettingsLogic,
    systemSettingsLogic,
    passwordSettingsLogic,
    onOpenExternal,
  } = settingsLogic();

  const { openChangePasswordDialog, ...passwordDialogLogic } =
    passwordSettingsLogic();

  const {
    isBoard,
    board,
    boardName,
    boardResources,
    bytesToGiB,
    setBoardName,
    keyboardLayout,
    keyboardLayouts,
    setKeyboardLayout,
  } = boardSettingsLogic();

  const {
    unsupportedLogic,
    attachLogic,
    enabled: isCarriersEnabled,
    pristine: isCarriersPristine,
    onEnabledChange: onCarriersEnabledChange,
    carriers,
    status: carriersStatus,
    setStatus: setCarriersStatus,
    passwordLogic: carriersPasswordLogic,
  } = carrierSettingsLogic();

  const {
    selectedConnectedNetwork,
    selectedConnectedIPAddress,
    openNetworkSettingsDialog,
    ...networkLogic
  } = networkSettingsLogic();

  const {
    currentAppVersion,
    hasBoardUpdate,
    needsImageUpdate,
    newAppVersion,
    osImageVersion,
    osReleaseDate,
    kernelVersion,
    linuxDistribution,
    openFlasher,
    startUpdate,
  } = systemSettingsLogic();

  const isVentunoQ = board?.fqbn === BOARD_FQBN.VENTUNO_Q;

  const {
    isConnecting,
    isDisconnecting,
    status: cloudConnectorStatus,
    connectBoard,
    connectDialogLogic: cloudConnectorConnectDialogLogic,
    disconnectBoard,
    disconnectDialogLogic: cloudConnectorDisconnectDialogLogic,
  } = cloudConnectorSettingsLogic();

  const keyboardLayoutItems = useMemo(
    () => [
      {
        name: 'Actions',
        items: keyboardLayouts.map((layout) => ({
          id: layout.id,
          label: layout.label,
        })),
      },
    ],
    [keyboardLayouts],
  );

  const dropdownClasses = useMemo(
    () => ({
      dropdownMenu: styles['dropdown-menu'],
      dropdownMenuButton: styles['dropdown-menu-button'],
      dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
      dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
      dropdownMenuPopover: styles['dropdown-menu-popover'],
    }),
    [],
  );

  const buttonChildren = useMemo(
    () => (
      <>
        {keyboardLayout?.label}
        <Sort />
      </>
    ),
    [keyboardLayout?.label],
  );

  return (
    <>
      <section>
        <SettingsSection.Title
          title={formatMessage(appMessages.title)}
          icon={<NavigationGroupOutline />}
        />
        <SettingsSection.Card>
          <SettingsSection.Row label={formatMessage(appMessages.appLabVersion)}>
            {!newAppVersion && (
              <div className={styles['app-lab-version']}>
                {currentAppVersion}
                <SettingsSection.UpToDateBadge
                  label={formatMessage(appMessages.appLabUpToDate)}
                />
              </div>
            )}
            {newAppVersion && !isBoard && (
              <Button
                Icon={Download}
                iconPosition="right"
                size={ButtonSize.XXSmall}
                onClick={startUpdate}
              >
                {formatMessage(appMessages.appLabUpdateAvailable, {
                  newAppVersion,
                })}
              </Button>
            )}
            {newAppVersion && isBoard && (
              <div className={styles['app-lab-version']}>
                {currentAppVersion}
                <SettingsSection.UpToDateBadge
                  label={formatMessage(appMessages.appLabUpToDate)}
                />
              </div>
            )}
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(appMessages.documentation)}>
            <SettingsSection.ExternalLink
              href={DOCUMENTATION_URL}
              onOpenExternal={onOpenExternal}
              label={formatMessage(appMessages.viewDocumentation)}
            />
          </SettingsSection.Row>
        </SettingsSection.Card>
      </section>
      <SettingsSection.Divider space={40} />
      <section>
        <SettingsSection.Title
          title={formatMessage(deviceMessages.title)}
          icon={<Board2 />}
        />
        <SettingsSection.Card>
          <DeviceHeader
            board={board}
            boardName={boardName}
            onChange={setBoardName}
          />
          <SettingsSection.Row label={formatMessage(deviceMessages.fqbn)}>
            {board?.fqbn || 'unknown'}
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(deviceMessages.serialNumber)}
          >
            <DeviceSerialNumber serial={board?.serial} />
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(deviceMessages.diskStorage)}
            classes={{
              wrapper: styles['device-storage-container'],
            }}
          >
            <DeviceStorage
              boardResources={boardResources}
              boardType={board?.type}
              bytesToGiB={bytesToGiB}
            />
          </SettingsSection.Row>
        </SettingsSection.Card>
      </section>
      {cloudConnectorStatus && (
        <section
          id="cloud-connector"
          className={styles['cloud-connector-section']}
        >
          {isConnecting && (
            <Banner
              type="waiting"
              title={formatMessage(cloudConnectorMessages.connectingTitle)}
              description={formatMessage(
                cloudConnectorMessages.connectingDescription,
              )}
            />
          )}
          {isDisconnecting && (
            <Banner
              type="waiting"
              title={formatMessage(cloudConnectorMessages.disconnectingTitle)}
              description={formatMessage(
                cloudConnectorMessages.disconnectingDescription,
              )}
            />
          )}
          <SettingsSection.Title
            title={formatMessage(cloudConnectorMessages.title)}
            variant="secondary"
          />
          <SettingsSection.Card>
            {cloudConnectorStatus.provisioning === 'provisioned' ? (
              <>
                <CloudConnectorDisconnectDialog
                  logic={cloudConnectorDisconnectDialogLogic}
                />
                <SettingsSection.Row
                  label={formatMessage(cloudConnectorMessages.connectedTitle)}
                >
                  <Badge
                    classes={{
                      container: styles['cloud-connector-section-badge'],
                    }}
                    uppercase={false}
                    icon={<Success />}
                    style={BadgeStyle.Light}
                    variant={BadgeVariant.Positive}
                  >
                    {formatMessage(cloudConnectorMessages.connectedBadge)}
                  </Badge>
                </SettingsSection.Row>
                <SettingsSection.Row
                  classes={{
                    label: styles['cloud-connector-section-description'],
                  }}
                  label={formatMessage(
                    cloudConnectorMessages.connectedDescription,
                  )}
                >
                  <SettingsSection.ExternalLink
                    href={`${Config.CLOUD_HOME_URL}/devices/${cloudConnectorStatus.device_id}`}
                    onOpenExternal={onOpenExternal}
                    label={formatMessage(
                      cloudConnectorMessages.openArduinoCloudButton,
                    )}
                  />
                </SettingsSection.Row>
                <SettingsSection.Divider />
                <SettingsSection.Row
                  label={formatMessage(cloudConnectorMessages.disconnectTitle)}
                >
                  <Button
                    disabled={isDisconnecting}
                    appearance={ButtonAppearance.LowContrast}
                    variant={ButtonVariant.Primary}
                    size={ButtonSize.XXSmall}
                    onClick={disconnectBoard}
                  >
                    {formatMessage(cloudConnectorMessages.disconnectAction)}
                  </Button>
                </SettingsSection.Row>
              </>
            ) : (
              <>
                <CloudConnectorConnectDialog
                  logic={cloudConnectorConnectDialogLogic}
                />
                <SettingsSection.Row
                  label={
                    <div className={styles['cloud-connector-section-connect']}>
                      <AccountArduinoCloud
                        className={
                          styles['cloud-connector-section-connect-icon']
                        }
                      />
                      <XXSmall
                        className={
                          styles['cloud-connector-section-connect-title']
                        }
                      >
                        {formatMessage(cloudConnectorMessages.connectTitle)}
                      </XXSmall>
                    </div>
                  }
                >
                  <Button
                    disabled={isConnecting}
                    variant={ButtonVariant.Secondary}
                    size={ButtonSize.XXSmall}
                    onClick={connectBoard}
                  >
                    {formatMessage(cloudConnectorMessages.connectAction)}
                  </Button>
                </SettingsSection.Row>
                <SettingsSection.Row
                  classes={{
                    label: styles['cloud-connector-section-description'],
                  }}
                  label={formatMessage(
                    cloudConnectorMessages.connectDescription,
                  )}
                >
                  <SettingsSection.ExternalLink
                    href={ARDUINO_CLOUD_URL}
                    onOpenExternal={onOpenExternal}
                    label={formatMessage(cloudConnectorMessages.moreInfoButton)}
                  />
                </SettingsSection.Row>
              </>
            )}
          </SettingsSection.Card>
        </section>
      )}
      {!isVentunoQ && (
        <section>
          <SettingsSection.Title
            title={formatMessage(carrierMessages.title)}
            variant="secondary"
          />
          <SettingsSection.Card>
            <UnsupportedCarrierDialog logic={unsupportedLogic} />
            <AttachCarrierDialog logic={attachLogic} />
            <SettingsSection.Row
              label={formatMessage(carrierMessages.carrierToggle, {
                boardType: board?.type.replace(/arduino/i, '').trim(),
              })}
            >
              <Toggle
                className={styles['toggle-button']}
                isSelected={isCarriersEnabled}
                onChange={onCarriersEnabledChange}
              />
            </SettingsSection.Row>
            {isCarriersEnabled &&
              carriers.map((group, index) => (
                <Fragment key={index}>
                  <SettingsSection.Divider />
                  <SettingsSection.Row
                    label={formatMessage(carrierMessages.carrierType)}
                  >
                    {group.name}
                  </SettingsSection.Row>
                  <SettingsSection.Row
                    label={formatMessage(carrierMessages.carrierDescription)}
                  >
                    <Fragment />
                  </SettingsSection.Row>
                  {group.devices.map((device, deviceIndex) => (
                    <CarrierOption
                      key={deviceIndex}
                      carrierName={group.name}
                      device={device}
                      status={carriersStatus}
                      onChange={setCarriersStatus}
                    />
                  ))}
                </Fragment>
              ))}
            {!isCarriersPristine && (
              <SettingsSection.Banner
                className={styles['carrier-banner-container']}
              >
                <PasswordDialog logic={carriersPasswordLogic} />
                <div className={styles['carrier-banner']}>
                  <div className={styles['carrier-banner-label']}>
                    <InfoSetup />
                    <XXSmall>
                      {formatMessage(carrierMessages.carrierInfo)}
                    </XXSmall>
                  </div>
                  <Button
                    size={ButtonSize.XXSmall}
                    onClick={(): void =>
                      carriersPasswordLogic.onOpenChange(true)
                    }
                  >
                    {formatMessage(carrierMessages.carrierButton)}
                  </Button>
                </div>
              </SettingsSection.Banner>
            )}
          </SettingsSection.Card>
        </section>
      )}
      <section>
        <SettingsSection.Title
          title={formatMessage(systemMessages.title)}
          variant="secondary"
        />
        <SettingsSection.Card>
          <ChangePasswordDialog logic={passwordDialogLogic} />
          <SettingsSection.Row
            label={formatMessage(systemMessages.systemVersion)}
            info={formatMessage(systemMessages.systemVersionInfo)}
          >
            {!hasBoardUpdate && (
              <SettingsSection.UpToDateBadge
                label={formatMessage(systemMessages.systemVersionUpToDate)}
              />
            )}
            {hasBoardUpdate && (
              <Button
                Icon={Download}
                iconPosition="right"
                size={ButtonSize.XXSmall}
                onClick={startUpdate}
              >
                {formatMessage(systemMessages.systemVersionUpdateAvailable)}
              </Button>
            )}
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(systemMessages.releaseNotes)}
          >
            <SettingsSection.ExternalLink
              href={RELEASE_NOTES_URL}
              onOpenExternal={onOpenExternal}
              label={formatMessage(systemMessages.viewReleaseNotes)}
            />
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(systemMessages.keyboardLanguage)}
          >
            <DropdownMenuButton
              sections={keyboardLayoutItems}
              buttonChildren={buttonChildren}
              useStaticPosition={false}
              onAction={(key): void => setKeyboardLayout(key as string)}
              classes={dropdownClasses}
            />
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(systemMessages.osPassword)}>
            <Button
              size={ButtonSize.XXSmall}
              appearance={ButtonAppearance.LowContrast}
              onClick={openChangePasswordDialog}
              Icon={Pencil}
            >
              {formatMessage(systemMessages.changePassword)}
            </Button>
          </SettingsSection.Row>
          <SettingsSection.Divider />
          <SettingsSection.Row
            label={formatMessage(systemMessages.remoteAccess)}
            info={formatMessage(systemMessages.remoteAccessInfo)}
            border-top
          >
            <NetworkMode
              disabled={board?.connectionType !== 'USB'}
              logic={networkModeLogic}
            />
          </SettingsSection.Row>
        </SettingsSection.Card>
      </section>
      <section>
        <SettingsSection.Title
          title={formatMessage(osMessages.title)}
          variant="secondary"
        />
        <SettingsSection.Card>
          {needsImageUpdate ? (
            <SettingsSection.Banner>
              <div className={styles['os-banner']}>
                <div className={styles['os-banner-label']}>
                  <Tools />
                  <XXSmall>
                    {formatMessage(osMessages.osBoardSoftwareBehind)}
                  </XXSmall>
                </div>
                <Button
                  Icon={Download}
                  iconPosition="right"
                  size={ButtonSize.XXSmall}
                  onClick={startUpdate}
                >
                  {formatMessage(osMessages.updateNow)}
                </Button>
              </div>
            </SettingsSection.Banner>
          ) : (
            <SettingsSection.Row label={formatMessage(osMessages.buildVersion)}>
              {osImageVersion}
            </SettingsSection.Row>
          )}
          <SettingsSection.Row
            label={formatMessage(osMessages.linuxDistribution)}
          >
            {linuxDistribution}
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(osMessages.kernelVersion)}>
            {kernelVersion}
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(osMessages.releaseDate)}>
            {osReleaseDate}
          </SettingsSection.Row>
          {!isBoard && !needsImageUpdate && !isVentunoQ && (
            <>
              <SettingsSection.Divider />
              <SettingsSection.Row
                label={formatMessage(osMessages.installOsImage)}
                info={formatMessage(osMessages.installOsImageInfo)}
                classes={{
                  value: styles['install-os-image'],
                }}
              >
                <Button
                  Icon={Reload}
                  appearance={ButtonAppearance.LowContrast}
                  iconPosition="right"
                  size={ButtonSize.XXSmall}
                  onClick={openFlasher}
                >
                  {formatMessage(osMessages.flashBoard)}
                </Button>
              </SettingsSection.Row>
            </>
          )}
        </SettingsSection.Card>
      </section>
      <section id="network">
        <SettingsSection.Title
          title={formatMessage(networkMessages.title)}
          variant="secondary"
        />
        <SettingsSection.Card>
          <NetworkSettingsDialog logic={networkLogic} />
          <SettingsSection.Row
            label={formatMessage(networkMessages.ssid)}
            classes={{
              value: styles['selected-network'],
            }}
          >
            {networkLogic.isConnected ? (
              <World
                aria-label={formatMessage(networkMessages.connected)}
                title={formatMessage(networkMessages.connected)}
              />
            ) : (
              <WorldDisconnected
                aria-label={formatMessage(networkMessages.noNetworkConnected)}
                title={formatMessage(networkMessages.noNetworkConnected)}
              />
            )}

            {selectedConnectedNetwork}
            <Button
              size={ButtonSize.XXSmall}
              appearance={ButtonAppearance.LowContrast}
              onClick={openNetworkSettingsDialog}
              Icon={OperationSort}
            >
              {formatMessage(networkMessages.changeNetwork)}
            </Button>
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(networkMessages.ip)}>
            {selectedConnectedIPAddress}
          </SettingsSection.Row>
        </SettingsSection.Card>
      </section>
      {agentSection ? (
        <>
          <SettingsSection.Divider space={40} />
          {agentSection}
        </>
      ) : null}
      <section className={styles['copyright']}>
        <XXXSmall>{formatMessage(settingsMessages.copyright)}</XXXSmall>
      </section>
    </>
  );
};
