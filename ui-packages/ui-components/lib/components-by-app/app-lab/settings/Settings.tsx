import {
  Board2,
  Download,
  NavigationGroupOutline,
  OperationSort,
  Pencil,
  Reload,
  Sort,
  Tools,
  World,
  WorldDisconnected,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ChangePasswordDialog,
  DropdownMenuButton,
  NetworkSettingsDialog,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { ButtonSize, ButtonVariant } from '../../../essential/app-lab-button';
import { useI18n } from '../../../i18n/useI18n';
import { SettingsSection } from '../settings-section';
import {
  appMessages,
  deviceMessages,
  networkMessages,
  osMessages,
  systemMessages,
} from './messages';
import styles from './settings.module.scss';
import { SettingsProps } from './settings.type';
import { DeviceHeader } from './subcomponents/DeviceHeader';
import { DeviceStorage } from './subcomponents/DeviceStorage';
import { NetworkMode } from './subcomponents/NetworkMode';

export const Settings: React.FC<SettingsProps> = ({
  settingsLogic,
}: SettingsProps) => {
  const { formatMessage } = useI18n();

  const {
    boardSettingsLogic,
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
    fqbn,
    boardResources,
    bytesToGiB,
    setBoardName,
    keyboardLayout,
    keyboardLayouts,
    setKeyboardLayout,
    isNetworkModeEnabled,
    setNetworkMode,
    isSettingNetworkMode,
  } = boardSettingsLogic();

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

  return (
    <>
      {!isBoard ? (
        <>
          <section>
            <SettingsSection.Title
              title={formatMessage(appMessages.title)}
              icon={<NavigationGroupOutline />}
            />
            <SettingsSection.Card>
              <SettingsSection.Row
                label={formatMessage(appMessages.appLabVersion)}
              >
                {!newAppVersion && (
                  <div className={styles['app-lab-version']}>
                    {currentAppVersion}
                    <SettingsSection.UpToDateBadge
                      label={formatMessage(appMessages.appLabUpToDate)}
                    />
                  </div>
                )}
                {newAppVersion && (
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
              </SettingsSection.Row>
              <SettingsSection.Row
                label={formatMessage(appMessages.documentation)}
              >
                <SettingsSection.ExternalLink
                  href="https://docs.arduino.cc/software/app-lab/"
                  onOpenExternal={onOpenExternal}
                  label={formatMessage(appMessages.viewDocumentation)}
                />
              </SettingsSection.Row>
            </SettingsSection.Card>
          </section>
          <SettingsSection.Divider space={40} />
        </>
      ) : null}
      <section>
        <SettingsSection.Title
          title={formatMessage(deviceMessages.title)}
          icon={<Board2 />}
        />
        <SettingsSection.Card>
          <DeviceHeader
            board={board}
            boardName={boardName}
            fqbn={fqbn}
            onChange={setBoardName}
          />
          <SettingsSection.Row label={formatMessage(deviceMessages.fqbn)}>
            {fqbn || 'unknown'}
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(deviceMessages.serialNumber)}
          >
            {board?.serial}
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(deviceMessages.diskStorage)}
            classes={{
              wrapper: styles['device-storage-container'],
            }}
          >
            <DeviceStorage
              boardResources={boardResources}
              bytesToGiB={bytesToGiB}
            />
          </SettingsSection.Row>
        </SettingsSection.Card>
      </section>
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
              href="https://github.com/arduino/arduino-app-lab/releases"
              onOpenExternal={onOpenExternal}
              label={formatMessage(systemMessages.viewReleaseNotes)}
            />
          </SettingsSection.Row>
          <SettingsSection.Row
            label={formatMessage(systemMessages.keyboardLanguage)}
          >
            <DropdownMenuButton
              sections={[
                {
                  name: 'Actions',
                  items: keyboardLayouts.map((layout) => ({
                    id: layout.id,
                    label: layout.label,
                  })),
                },
              ]}
              buttonChildren={
                <>
                  {keyboardLayout?.label}
                  <Sort />
                </>
              }
              useStaticPosition={false}
              onAction={(key): void => setKeyboardLayout(key as string)}
              classes={{
                dropdownMenu: styles['dropdown-menu'],
                dropdownMenuButton: styles['dropdown-menu-button'],
                dropdownMenuButtonWrapper:
                  styles['dropdown-menu-button-wrapper'],
                dropdownMenuPopover: styles['dropdown-menu-popover'],
              }}
            />
          </SettingsSection.Row>
          <SettingsSection.Row label={formatMessage(systemMessages.osPassword)}>
            <Button
              size={ButtonSize.XXSmall}
              variant={ButtonVariant.LowContrast}
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
              isNetworkModeEnabled={isNetworkModeEnabled}
              isSettingNetworkMode={isSettingNetworkMode}
              setNetworkMode={setNetworkMode}
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
          {!isBoard && !needsImageUpdate && (
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
                  variant={ButtonVariant.LowContrast}
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
      <section>
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
              variant={ButtonVariant.LowContrast}
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
    </>
  );
};
