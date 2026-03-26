import {
  NavigationGroup,
  Plus,
  UploadLight,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AppItem as Card,
  Button,
  ButtonType,
  CreateAppDialog,
  DropdownMenuButton,
  ImportAppDialog,
  TopBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Link } from '@tanstack/react-router';
import React, { Key } from 'react';

import { AppsSection } from '../app.type';
import styles from './app-list.module.scss';
import { useAppListLogic } from './appList.logic';
import {
  appListMessages as messages,
  emptyDescriptionMessages,
  emptyTitleMessages,
} from './messages';

interface AppListProps {
  section: AppsSection;
}

const AppList: React.FC<AppListProps> = (props: AppListProps) => {
  const { section } = props as AppListProps & {
    section: AppsSection;
  };
  const {
    apps,
    isLoading: appsLoading,
    createAppDialogLogic,
    importAppDialogLogic,
    openCreateAppDialog,
    openImportAppDialog,
    importedAppId,
  } = useAppListLogic(section);

  const { formatMessage } = useI18n();

  return (
    <section className={styles['main']}>
      <CreateAppDialog logic={createAppDialogLogic} />
      <ImportAppDialog logic={importAppDialogLogic} />
      <TopBar pathItems={[section]}>
        <div />
        <div className={styles['actions']}>
          {section === 'my-apps' && (
            <DropdownMenuButton
              sections={[
                {
                  name: 'Apps actions',
                  items: [
                    {
                      id: 'create-app',
                      label: formatMessage(messages.createNewApp),
                      labelPrefix: <Plus />,
                    },
                    {
                      id: 'import-app',
                      label: formatMessage(messages.importApp),
                      labelPrefix: <UploadLight />,
                    },
                  ],
                },
              ]}
              classes={{
                dropdownMenu: styles['dropdown-menu'],
                dropdownMenuButtonWrapper:
                  styles['dropdown-menu-button-wrapper'],
                dropdownMenuItem: styles['dropdown-menu-item'],
              }}
              onAction={(key: Key): void =>
                key === 'create-app'
                  ? openCreateAppDialog()
                  : openImportAppDialog()
              }
              useStaticPosition
              buttonChildren={(buttonProps, buttonRef): React.ReactNode => (
                <Button
                  {...buttonProps}
                  ref={buttonRef}
                  type={ButtonType.Primary}
                  Icon={Plus}
                  iconPosition="right"
                  title={formatMessage(messages.actionCreate)}
                >
                  {formatMessage(messages.actionCreate)}
                </Button>
              )}
            />
          )}
        </div>
      </TopBar>
      {!appsLoading && apps.length === 0 ? (
        <div className={styles['empty-apps']}>
          <div className={styles['empty-apps-icon']}>
            <NavigationGroup />
          </div>
          <span>{formatMessage(emptyTitleMessages[section])}</span>
          <p>{formatMessage(emptyDescriptionMessages[section])}</p>
        </div>
      ) : null}
      {/* My apps grid*/}
      <div className={styles['my-apps']}>
        {/* Loading state */}
        {appsLoading ? <Card variant="skeleton" /> : null}
        {/* App cards */}
        {!appsLoading && apps.length > 0
          ? apps.map((app, i) => (
              <Link
                key={i}
                className={`${styles['app-link']} ${
                  app.id === importedAppId
                    ? styles['app-link--highlighted']
                    : ''
                }`}
                to={`/${section}/$appId`}
                params={{ appId: app.id || '' }}
              >
                <Card {...app} />
              </Link>
            ))
          : null}
      </div>
    </section>
  );
};

export default AppList;
