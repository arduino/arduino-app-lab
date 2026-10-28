import { BOARD_FQBN, Config } from '@cloud-editor-mono/common';
import {
  AccountArduinoCloud,
  Board2,
  ChevronDown,
  Download,
  Hardware,
  NavigationGroupOutline,
  OperationSort,
  Pencil,
  Reload,
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
  BoardExtensionsAttachDialog,
  Button,
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
  ChangePasswordDialog,
  CloudConnectorConnectDialog,
  CloudConnectorDisconnectDialog,
  DropdownMenuButton,
  PasswordDialog,
  useTooltip,
  XSmall,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Fragment, useMemo } from 'react';

import { useI18n } from '../../../i18n/useI18n';
import { Toggle } from '../essential/toggle';
import { SettingsSection } from '../settings-section';
import {
  appMessages,
  boardExtensionsMessages,
  cloudConnectorMessages,
  csiCameraMessages,
  deviceMessages,
  networkMessages,
  osMessages,
  settingsMessages,
  systemMessages,
} from './messages';
import styles from './settings.module.scss';
import { SettingsProps } from './settings.type';
import { BoardExtensionsFooter } from './subcomponents/BoardExtensionsFooter';
import { CarrierOption } from './subcomponents/CarrierOption';
import { DeviceHeader } from './subcomponents/DeviceHeader';
import { DeviceSerialNumber } from './subcomponents/DeviceSerialNumber';
import { DeviceStorage } from './subcomponents/DeviceStorage';
import { NetworkMode } from './subcomponents/NetworkMode';
import { TerminalSelector } from './subcomponents/TerminalSelector';

// Anchor for the agent section, so a caller can deep-link to it (`/settings#...`) rather than repeat the id.
export const AGENT_SETTINGS_SECTION_ID = 'agent-settings-section';

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
  const CSI_CAMERA_SETUP_GUIDE_URL =
    'https://docs.arduino.cc/tutorials/ventuno-q/mipi-csi-camera/';

  const {
    cloudConnectorSettingsLogic,
    boardSettingsLogic,
    boardExtensionsSettingsLogic,
    networkModeLogic,
    networkSettingsLogic,
    systemSettingsLogic,
    passwordSettingsLogic,
    terminalSettingsLogic,
    onOpenExternal,
  } = settingsLogic();

  const { openChangePasswordDialog, changePasswordLogic } =
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
    setBoardNameIsError,
    boardNameErrorMsg,
  } = boardSettingsLogic();

  const {
    status: boardExtensionsStatus,
    attachLogic: attachBoardExtensionsLogic,
    supported: isBoardExtensionsSupported,
    openAttachCarrierDialog,
    openAttachHatDialog,
    carrierEnabled: isCarrierEnabled,
    onCarrierEnabledChange,
    carrierPristine: isCarrierPristine,
    carriers,
    setCarrierStatus,
    passwordLogic: boardExtensionsPasswordLogic,
    hatEnabled: isHatEnabled,
    onHatEnabledChange,
    hatPristine: isHatPristine,
    hats,
    setHatStatus,
    openPasswordDialog: openBoardExtensionsPasswordDialog,
  } = boardExtensionsSettingsLogic();

  const {
    isConnected,
    selectedConnectedNetwork,
    selectedConnectedIPAddress,
    openNetworkSettingsDialog,
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

  const {
    props: tooltipPropsAppUpdate,
    renderTooltip: renderTooltipAppUpdate,
  } = useTooltip({
    content: formatMessage(appMessages.appLabUpdateAvailable, {
      newAppVersion: newAppVersion || '',
    }),
    timeout: 0,
  });

  const {
    props: tooltipPropsDisconnect,
    renderTooltip: renderTooltipDisconnect,
  } = useTooltip({
    content: formatMessage(cloudConnectorMessages.disconnectAction),
    timeout: 0,
  });

  const { props: tooltipPropsConnect, renderTooltip: renderTooltipConnect } =
    useTooltip({
      content: formatMessage(cloudConnectorMessages.connectAction),
      timeout: 0,
    });

  const {
    props: tooltipPropsSystemUpdate,
    renderTooltip: renderTooltipSystemUpdate,
  } = useTooltip({
    content: formatMessage(systemMessages.systemVersionUpdateAvailable),
    timeout: 0,
  });

  const { props: tooltipPropsPassword, renderTooltip: renderTooltipPassword } =
    useTooltip({
      content: formatMessage(systemMessages.changePassword),
      timeout: 0,
    });

  const {
    props: tooltipPropsUpdateNow,
    renderTooltip: renderTooltipUpdateNow,
  } = useTooltip({
    content: formatMessage(osMessages.updateNow),
    timeout: 0,
  });

  const { props: tooltipPropsFlash, renderTooltip: renderTooltipFlash } =
    useTooltip({
      content: formatMessage(osMessages.flashBoard),
      timeout: 0,
    });

  const {
    props: tooltipPropsChangeNetwork,
    renderTooltip: renderTooltipChangeNetwork,
  } = useTooltip({
    content: formatMessage(networkMessages.changeNetwork),
    timeout: 0,
  });

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
        <ChevronDown />
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
              <>
                <div
                  {...tooltipPropsAppUpdate}
                  className={styles['tooltip-wrapper']}
                >
                  <Button
                    Icon={Download}
                    iconPosition="right"
                    size={ButtonSize.XSmall}
                    onClick={startUpdate}
                  >
                    {formatMessage(appMessages.appLabUpdateAvailable, {
                      newAppVersion,
                    })}
                  </Button>
                </div>
                {renderTooltipAppUpdate()}
              </>
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
            isError={setBoardNameIsError}
            errorMsg={boardNameErrorMsg}
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
              isVentunoQ={isVentunoQ}
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
                  <div
                    {...tooltipPropsDisconnect}
                    className={styles['tooltip-wrapper']}
                  >
                    <Button
                      disabled={isDisconnecting}
                      appearance={ButtonAppearance.LowContrast}
                      variant={ButtonVariant.Primary}
                      size={ButtonSize.XSmall}
                      onClick={disconnectBoard}
                    >
                      {formatMessage(cloudConnectorMessages.disconnectAction)}
                    </Button>
                  </div>
                  {renderTooltipDisconnect()}
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
                      <XSmall
                        className={
                          styles['cloud-connector-section-connect-title']
                        }
                      >
                        {formatMessage(cloudConnectorMessages.connectTitle)}
                      </XSmall>
                    </div>
                  }
                >
                  <div
                    {...tooltipPropsConnect}
                    className={styles['tooltip-wrapper']}
                  >
                    <Button
                      disabled={isConnecting}
                      variant={ButtonVariant.Secondary}
                      size={ButtonSize.XSmall}
                      onClick={connectBoard}
                    >
                      {formatMessage(cloudConnectorMessages.connectAction)}
                    </Button>
                  </div>
                  {renderTooltipConnect()}
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
      {(!isBoardExtensionsSupported ||
        carriers.length !== 0 ||
        hats.length !== 0) && (
        <section>
          <SettingsSection.Title
            title={formatMessage(boardExtensionsMessages.title)}
            variant="secondary"
          />
          <PasswordDialog logic={boardExtensionsPasswordLogic} />
          <BoardExtensionsAttachDialog logic={attachBoardExtensionsLogic} />
          {!isBoardExtensionsSupported ? (
            <SettingsSection.Banner
              className={styles['board-extensions-banner']}
            >
              <div className={styles['board-extensions-banner-label']}>
                <Hardware />
                <XSmall semibold>
                  {formatMessage(boardExtensionsMessages.unsupportedTitle)}
                </XSmall>
              </div>
              <XXSmall>
                {formatMessage(boardExtensionsMessages.unsupportedDescription)}
              </XXSmall>
            </SettingsSection.Banner>
          ) : (
            <>
              {carriers.length !== 0 && (
                <SettingsSection.Card>
                  <SettingsSection.Row
                    label={formatMessage(boardExtensionsMessages.carrierTitle)}
                    classes={{
                      value: styles['board-extensions-button-row'],
                    }}
                  >
                    <Toggle
                      className={styles['toggle-button']}
                      isSelected={isCarrierEnabled}
                      onChange={onCarrierEnabledChange}
                    />
                    <Button
                      variant={ButtonVariant.Tertiary}
                      size={ButtonSize.XSmall}
                      onClick={openAttachCarrierDialog}
                    >
                      {formatMessage(boardExtensionsMessages.carrierButton)}
                    </Button>
                  </SettingsSection.Row>
                  {isCarrierEnabled && (
                    <>
                      <SettingsSection.Divider />
                      <XXSmall
                        semibold
                        className={
                          styles['board-extensions-carrier-description']
                        }
                      >
                        {formatMessage(
                          isVentunoQ
                            ? boardExtensionsMessages.carrierDescriptionVentunoQ
                            : boardExtensionsMessages.carrierDescription,
                        )}
                      </XXSmall>
                      {carriers.map((group, index) => (
                        <Fragment key={index}>
                          {group.devices.map((device, deviceIndex) => (
                            <CarrierOption
                              key={deviceIndex}
                              carrierName={group.name}
                              device={device}
                              status={boardExtensionsStatus}
                              onChange={setCarrierStatus}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </>
                  )}
                  {!isCarrierPristine && (
                    <BoardExtensionsFooter
                      openPasswordDialog={openBoardExtensionsPasswordDialog}
                    />
                  )}
                </SettingsSection.Card>
              )}
              {carriers.length !== 0 && hats.length !== 0 && (
                <SettingsSection.Divider
                  space={12}
                  className={styles['board-extensions-divider']}
                />
              )}
              {hats.length !== 0 && (
                <SettingsSection.Card>
                  <SettingsSection.Row
                    label={formatMessage(boardExtensionsMessages.hatTitle)}
                    classes={{
                      value: styles['board-extensions-button-row'],
                    }}
                  >
                    <Toggle
                      className={styles['toggle-button']}
                      isSelected={isHatEnabled}
                      onChange={onHatEnabledChange}
                    />
                    <Button
                      variant={ButtonVariant.Tertiary}
                      size={ButtonSize.XSmall}
                      onClick={openAttachHatDialog}
                    >
                      {formatMessage(boardExtensionsMessages.hatButton)}
                    </Button>
                  </SettingsSection.Row>
                  {isHatEnabled && (
                    <>
                      <SettingsSection.Divider />
                      <SettingsSection.Row
                        label={formatMessage(boardExtensionsMessages.hatType)}
                        classes={{
                          value: styles['hat-type'],
                        }}
                      >
                        <DropdownMenuButton
                          sections={[
                            {
                              name: 'Actions',
                              items: [
                                {
                                  id: 'none',
                                  label: formatMessage(
                                    boardExtensionsMessages.hatTypePlaceholder,
                                  ),
                                },
                                ...hats.map((option) => ({
                                  id: option.name,
                                  label: option.name,
                                })),
                              ],
                            },
                          ]}
                          buttonChildren={
                            <>
                              {boardExtensionsStatus.mounts.find(
                                (mount) =>
                                  mount.kind === 'hat' && mount.nextEnabled,
                              )?.name ||
                                formatMessage(
                                  boardExtensionsMessages.hatTypePlaceholder,
                                )}
                              <ChevronDown />
                            </>
                          }
                          useStaticPosition={false}
                          onAction={(key): void => setHatStatus(key as string)}
                          classes={{
                            dropdownMenu: styles['dropdown-menu'],
                            dropdownMenuButton: styles['dropdown-menu-button'],
                            dropdownMenuButtonOpen:
                              styles['dropdown-menu-button-open'],
                            dropdownMenuButtonWrapper:
                              styles['dropdown-menu-button-wrapper'],
                            dropdownMenuPopover:
                              styles['dropdown-menu-popover'],
                          }}
                        />
                        <SettingsSection.Info>
                          {formatMessage(boardExtensionsMessages.hatTooltip)}
                        </SettingsSection.Info>
                      </SettingsSection.Row>
                    </>
                  )}
                  {!isHatPristine && (
                    <BoardExtensionsFooter
                      openPasswordDialog={openBoardExtensionsPasswordDialog}
                    />
                  )}
                </SettingsSection.Card>
              )}
            </>
          )}
        </section>
      )}
      {isVentunoQ && linuxDistribution?.toLowerCase().includes('ubuntu') && (
        <section>
          <SettingsSection.Title
            title={formatMessage(csiCameraMessages.title)}
            variant="secondary"
          />
          <SettingsSection.Card>
            <SettingsSection.Row
              label={formatMessage(csiCameraMessages.description)}
            >
              <SettingsSection.ExternalLink
                href={CSI_CAMERA_SETUP_GUIDE_URL}
                onOpenExternal={onOpenExternal}
                label={formatMessage(csiCameraMessages.link)}
              />
            </SettingsSection.Row>
          </SettingsSection.Card>
        </section>
      )}
      <section>
        <SettingsSection.Title
          title={formatMessage(systemMessages.title)}
          variant="secondary"
        />
        <SettingsSection.Card>
          <ChangePasswordDialog logic={changePasswordLogic} />
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
              <>
                <div
                  {...tooltipPropsSystemUpdate}
                  className={styles['tooltip-wrapper']}
                >
                  <Button
                    Icon={Download}
                    iconPosition="right"
                    size={ButtonSize.XSmall}
                    onClick={startUpdate}
                  >
                    {formatMessage(systemMessages.systemVersionUpdateAvailable)}
                  </Button>
                </div>
                {renderTooltipSystemUpdate()}
              </>
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
              // react-aria computes the position against the viewport, which
              // only matches where the popover is placed when it is portaled.
              useStaticPosition={false}
              usePortal
              onAction={(key): void => setKeyboardLayout(key as string)}
              classes={dropdownClasses}
            />
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(systemMessages.terminal)}
            info={formatMessage(systemMessages.terminalInfo)}
            classes={{
              wrapper: styles['terminal-row'],
              value: styles['terminal-row-value'],
            }}
          >
            <TerminalSelector logic={terminalSettingsLogic} />
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(systemMessages.osPassword)}>
            <div
              {...tooltipPropsPassword}
              className={styles['tooltip-wrapper']}
            >
              <Button
                size={ButtonSize.XSmall}
                appearance={ButtonAppearance.LowContrast}
                onClick={openChangePasswordDialog}
                Icon={Pencil}
              >
                {formatMessage(systemMessages.changePassword)}
              </Button>
            </div>
            {renderTooltipPassword()}
          </SettingsSection.Row>
          <SettingsSection.Divider />
          <SettingsSection.Row
            label={formatMessage(systemMessages.remoteAccess)}
            info={formatMessage(systemMessages.remoteAccessInfo)}
            border-top
          >
            {/* connectionType can be 'USB', 'Network', or 'Local'. SBC Mode uses 'Local', which was incorrectly disabled by the !== 'USB' check. Only Network should be disabled (already connected over network). */}
            <NetworkMode
              disabled={board?.connectionType === 'Network'}
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
                  <XSmall>
                    {formatMessage(osMessages.osBoardSoftwareBehind)}
                  </XSmall>
                </div>
                <div
                  {...tooltipPropsUpdateNow}
                  className={styles['tooltip-wrapper']}
                >
                  <Button
                    Icon={Download}
                    iconPosition="right"
                    size={ButtonSize.XSmall}
                    onClick={isBoard ? startUpdate : openFlasher}
                  >
                    {formatMessage(osMessages.updateNow)}
                  </Button>
                </div>
                {renderTooltipUpdateNow()}
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
          {!isBoard && !needsImageUpdate && (
            <>
              <SettingsSection.Divider />
              <SettingsSection.Row
                label={formatMessage(osMessages.installOsImage)}
                info={formatMessage(osMessages.installOsImageInfo)}
              >
                <div
                  {...tooltipPropsFlash}
                  className={styles['tooltip-wrapper']}
                >
                  <Button
                    Icon={Reload}
                    appearance={ButtonAppearance.LowContrast}
                    iconPosition="right"
                    size={ButtonSize.XSmall}
                    onClick={openFlasher}
                  >
                    {formatMessage(osMessages.flashBoard)}
                  </Button>
                  {renderTooltipFlash()}
                </div>
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
          {/* The network settings dialog itself is rendered once, app-wide, by
              main; openNetworkSettingsDialog opens that instance. */}
          <SettingsSection.Row
            label={formatMessage(networkMessages.ssid)}
            classes={{
              value: styles['selected-network'],
            }}
          >
            {isConnected ? (
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
            <div
              {...tooltipPropsChangeNetwork}
              className={styles['tooltip-wrapper']}
            >
              <Button
                size={ButtonSize.XSmall}
                appearance={ButtonAppearance.LowContrast}
                onClick={openNetworkSettingsDialog}
                Icon={OperationSort}
              >
                {formatMessage(networkMessages.changeNetwork)}
              </Button>
            </div>
            {renderTooltipChangeNetwork()}
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(networkMessages.ip)}>
            {selectedConnectedIPAddress}
          </SettingsSection.Row>
        </SettingsSection.Card>
      </section>
      {agentSection ? (
        <div id={AGENT_SETTINGS_SECTION_ID}>
          <SettingsSection.Divider space={40} />
          {agentSection}
        </div>
      ) : null}
      <section className={styles['copyright']}>
        <XXSmall>{formatMessage(settingsMessages.copyright)}</XXSmall>
      </section>
    </>
  );
};
