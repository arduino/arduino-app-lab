import {
  NavigationGroup,
  Plus,
  UploadLight,
} from '@cloud-editor-mono/images/assets/icons';
import {
  AppItem as Card,
  AppsSection,
  Button,
  ButtonVariant,
  CreateAppDialog,
  DeleteAppDialog,
  DropdownMenuButton,
  ExportAppDialog,
  ImportResourceDialog,
  RenameAppDialog,
  TopBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import React, { Key } from 'react';

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

const AppList: React.FC<AppListProps> = ({ section }) => {
  const [menuOpenAppId, setMenuOpenAppId] = React.useState<string | null>(null);
  const [animatingAppId, setAnimatingAppId] = React.useState<string | null>(
    null,
  );

  const {
    apps,
    isLoading: appsLoading,
    createAppDialogLogic,
    importAppDialogLogic,
    openCreateAppDialog,
    openImportAppDialog,
    importedAppId,
    appActions,
    deleteAppDialogLogic,
    duplicateAppDialogLogic,
    renameAppDialogLogic,
    exportAppDialogLogic,
    defaultApp,
    handleAppClick,
  } = useAppListLogic(section);

  const { formatMessage } = useI18n();

  // Reset animating state when importedAppId changes
  React.useEffect(() => {
    if (importedAppId) {
      setAnimatingAppId(importedAppId);
      // Reset after animation duration (3.3s)
      setTimeout(() => {
        setAnimatingAppId(null);
      }, 3300);
    }
  }, [importedAppId]);

  return (
    <section className={styles['main']}>
      <CreateAppDialog logic={createAppDialogLogic} />
      <CreateAppDialog logic={duplicateAppDialogLogic} />
      <RenameAppDialog logic={renameAppDialogLogic} />
      <DeleteAppDialog logic={deleteAppDialogLogic} />
      <ExportAppDialog logic={exportAppDialogLogic} />
      <ImportResourceDialog logic={importAppDialogLogic} />

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
              buttonChildren={(buttonProps, buttonRef): React.ReactElement => (
                <Button
                  {...buttonProps}
                  ref={buttonRef}
                  variant={ButtonVariant.Primary}
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

      {!appsLoading && apps.length === 0 && (
        <div className={styles['empty-apps']}>
          <div className={styles['empty-apps-icon']}>
            <NavigationGroup />
          </div>
          <span>{formatMessage(emptyTitleMessages[section])}</span>
          <p>{formatMessage(emptyDescriptionMessages[section])}</p>
        </div>
      )}

      <div className={styles['my-apps']}>
        {appsLoading && <Card variant="skeleton" />}

        {!appsLoading &&
          apps.length > 0 &&
          apps.map((app, i) => (
            <div
              key={i}
              className={clsx(
                styles['app-link'],
                app.id === importedAppId && styles['app-link--highlighted'],
                menuOpenAppId === app.id && styles['menu-open'],
              )}
              onClick={(e: React.MouseEvent): void =>
                handleAppClick(app.id || '', e)
              }
              role="button"
              tabIndex={0}
              onKeyUp={(e: React.KeyboardEvent): void => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleAppClick(app.id || '');
                }
              }}
            >
              <Card
                {...app}
                {...(section === 'my-apps' && {
                  defaultApp,
                  onRename: (): void => appActions.onRename(app),
                  onDuplicate: (): void => appActions.onDuplicate(app),
                  onExport: (): void => appActions.onExport(app),
                  onSetAsDefault: (): void => appActions.onSetAsDefault(app),
                  onDelete: (): void => appActions.onDelete(app),
                  onMenuOpen: (isOpen: boolean): void =>
                    setMenuOpenAppId(isOpen ? app.id || null : null),
                  isAnimating: app.id === animatingAppId,
                })}
              />
            </div>
          ))}
      </div>
    </section>
  );
};

export default AppList;
