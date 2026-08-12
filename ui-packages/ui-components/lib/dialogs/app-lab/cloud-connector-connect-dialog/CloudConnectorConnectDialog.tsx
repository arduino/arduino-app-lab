import {
  Checkmark,
  ChevronDown,
  CloudConnectorIllustration as CloudConnectorIllustrationIcon,
  TriangleSharp,
} from '@cloud-editor-mono/images/assets/icons';
import { appLabCloudConnectorOrganization } from '@cloud-editor-mono/images/assets/images/images-by-app/app-lab';
import { CloudConnectorOrganization } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { Button, DropdownMenuButton } from '../../../components-by-app/app-lab';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall, XXSmall, XXXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { cloudConnectorConnectDialogMessages as messages } from '../messages';
import styles from './cloud-connector-connect-dialog.module.scss';

export type CloudConnectorConnectDialogLogic = () => {
  open: boolean;
  isConnected: boolean;
  loggedIn: boolean;
  organizations: CloudConnectorOrganization[];
  connect: () => void;
  login: () => void;
  confirmAction: (organization: CloudConnectorOrganization) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

type CloudConnectorConnectDialogProps = {
  logic: CloudConnectorConnectDialogLogic;
};

export const CloudConnectorConnectDialog: React.FC<
  CloudConnectorConnectDialogProps
> = ({ logic }: CloudConnectorConnectDialogProps) => {
  const [networkRequested, setNetworkRequested] = useState(false);
  const [loginRequested, setLoginRequested] = useState(false);
  const [introView, setIntroView] = useState(true);
  const [selectedOrganization, setSelectedOrganization] =
    useState<CloudConnectorOrganization | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const {
    open,
    isConnected,
    loggedIn,
    organizations,
    login,
    connect,
    confirmAction,
    onOpenChange,
  } = logic();

  const { formatMessage } = useI18n();

  const organizationSections = useMemo(
    () => [
      {
        name: 'organizations',
        items: organizations.map((organization) => ({
          id: organization.id,
          label: organization.name,
          node: (
            <div className={styles['organizations-select-item']}>
              <div className={styles['organizations-select-item-icon']}>
                {organization.logo ? (
                  <img src={organization.logo} alt={organization.name} />
                ) : (
                  appLabCloudConnectorOrganization
                )}
              </div>
              <div className={styles['organizations-select-item-info']}>
                <XXSmall className={styles['organizations-select-item-name']}>
                  {organization.name}
                </XXSmall>
                <XXXSmall
                  className={styles['organizations-select-item-description']}
                >
                  {organization.type}
                </XXXSmall>
              </div>
              {organization.id === selectedOrganization?.id && (
                <Checkmark
                  className={styles['organizations-select-item-selected']}
                />
              )}
            </div>
          ),
        })),
      },
    ],
    [organizations, selectedOrganization?.id],
  );

  useEffect(() => {
    setIntroView(true);
    setLoginRequested(false);
    setDropdownOpen(false);
  }, [open]);

  useEffect(() => {
    if (organizations.length) {
      setSelectedOrganization(organizations[0]);
    } else {
      setSelectedOrganization(null);
    }
  }, [open, organizations]);

  useEffect(() => {
    if (isConnected && networkRequested) {
      setNetworkRequested(false);
      onOpenChange(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, networkRequested]);

  useEffect(() => {
    if (loggedIn && loginRequested) {
      setIntroView(false);
    }
  }, [loggedIn, loginRequested]);

  const connectToWifi = (): void => {
    setNetworkRequested(true);
    connect();
  };

  const continueTo = (): void => {
    if (!loggedIn) {
      setLoginRequested(true);
      login();
    } else {
      setIntroView(false);
    }
  };

  const confirm = (): void => {
    if (!selectedOrganization) return;
    confirmAction(selectedOrganization);
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      footer={
        !isConnected ? (
          <Button onClick={connectToWifi}>
            {formatMessage(messages.networkButton)}
          </Button>
        ) : introView ? (
          <Button onClick={continueTo}>
            {formatMessage(messages.continueButton)}
          </Button>
        ) : (
          <Button onClick={confirm}>
            {formatMessage(messages.confirmButton)}
          </Button>
        )
      }
      classes={{
        body: styles['body'],
      }}
    >
      {!isConnected ? (
        <div className={styles['body-wrapper-network']}>
          <TriangleSharp className={styles['network-icon']} />
          <Medium className={styles['body-title']}>
            {formatMessage(messages.networkTitle)}
          </Medium>
          <XSmall className={styles['body-description']}>
            {formatMessage(messages.networkDescription)}
          </XSmall>
        </div>
      ) : introView ? (
        <div className={styles['body-wrapper']}>
          <CloudConnectorIllustrationIcon className={styles['body-icon']} />
          <div className={styles['body-content']}>
            <Medium className={styles['body-title']}>
              {formatMessage(messages.dialogBodyTitle)}
            </Medium>
            <XSmall className={styles['body-description']}>
              {formatMessage(messages.dialogBodyDescription, {
                bold: (text: string) => <b>{text}</b>,
              })}
            </XSmall>
          </div>
        </div>
      ) : (
        <div
          className={clsx(styles['body-content'], styles['body-content-full'])}
        >
          <Medium className={styles['body-title']}>
            {formatMessage(messages.dialogBodyTitle)}
          </Medium>
          <XSmall className={styles['body-description']}>
            {formatMessage(messages.dialogBodyDescription2)}
          </XSmall>
          <div
            role="button"
            tabIndex={0}
            className={styles['organizations-select']}
            onClick={(): void => setDropdownOpen((prev) => !prev)}
            onKeyDown={(e): void => {
              if (e.key === 'Enter' || e.key === ' ') {
                setDropdownOpen((prev) => !prev);
              }
            }}
          >
            <div className={styles['organizations-select-icon']}>
              {selectedOrganization?.logo ? (
                <img
                  src={selectedOrganization.logo}
                  alt={selectedOrganization?.name}
                />
              ) : (
                appLabCloudConnectorOrganization
              )}
            </div>
            <div className={styles['organizations-select-info']}>
              <XSmall className={styles['organizations-select-info-name']}>
                {selectedOrganization?.name}
              </XSmall>
              <XXSmall className={styles['organizations-select-info-type']}>
                {selectedOrganization?.type}
              </XXSmall>
            </div>
            <DropdownMenuButton
              isOpen={dropdownOpen}
              sections={organizationSections}
              classes={{
                dropdownMenu: clsx(styles['dropdown-menu']),
                dropdownMenuItem: clsx(styles['dropdown-menu-item']),
                dropdownMenuList: clsx(styles['dropdown-menu-list']),
                dropdownMenuButton: clsx(styles['dropdown-menu-button']),
                dropdownMenuButtonOpen: clsx(
                  styles['dropdown-menu-button-open'],
                ),
                dropdownMenuButtonWrapper: clsx(
                  styles['dropdown-menu-button-wrapper'],
                ),
                dropdownMenuPopover: styles['dropdown-menu-popover'],
              }}
              useStaticPosition={false}
              onAction={(key): void => {
                setDropdownOpen(false);

                const organization = organizations.find(
                  (org) => org.id === key,
                );
                if (organization) {
                  setSelectedOrganization(organization);
                }
              }}
              buttonChildren={
                <ChevronDown
                  className={clsx(styles['dropdown-menu-button-icon'], {
                    [styles['dropdown-menu-button-icon--open']]: dropdownOpen,
                  })}
                  onClick={(): void => setDropdownOpen((prev) => !prev)}
                />
              }
            />
          </div>
        </div>
      )}
    </AppLabDialog>
  );
};
