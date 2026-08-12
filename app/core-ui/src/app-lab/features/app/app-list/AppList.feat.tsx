import { NavigationGroup, Plus } from '@cloud-editor-mono/images/assets/icons';
import {
  AppActionsMenu,
  AppItem as Card,
  AppsSection,
  Button,
  ButtonSize,
  ButtonVariant,
  CreateAppDialog,
  DeleteAppDialog,
  EmptyState,
  ExportAppDialog,
  PageLayout,
  RenameAppDialog,
  SearchField,
  TopBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import React, { useState } from 'react';

import styles from './app-list.module.scss';
import { useAppListLogic } from './appList.logic';
import {
  appListMessages as messages,
  emptyDescriptionMessages,
  emptySearchMessages,
  EmptyStateKey,
  emptyTitleMessages,
} from './messages';

interface AppListProps {
  section: AppsSection;
  breadcrumbId?: string;
}

const AppList: React.FC<AppListProps> = ({ section, breadcrumbId }) => {
  const [menuOpenAppId, setMenuOpenAppId] = React.useState<string | null>(null);
  const [animatingAppId, setAnimatingAppId] = React.useState<string | null>(
    null,
  );
  // what is typed vs what is actually applied: the list only filters on Enter
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    apps,
    isLoading: appsLoading,
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
  } = useAppListLogic(section, breadcrumbId);

  const { formatMessage } = useI18n();

  const filteredApps = React.useMemo(() => {
    if (!searchQuery || section !== 'examples') return apps || [];
    const query = searchQuery.toLowerCase();
    return (apps || []).filter((app) =>
      app.name?.toLowerCase().includes(query),
    );
  }, [apps, searchQuery, section]);

  const showSearchField =
    section === 'examples' && !appsLoading && (apps?.length ?? 0) > 0;
  const isSearching = searchQuery !== '' && section === 'examples';

  // Empty-state copy follows the breadcrumb origin so the inspirations
  // page reads "No inspirations found" rather than the examples copy.
  const emptyKey: EmptyStateKey =
    breadcrumbId === 'inspirations' ? 'inspirations' : section;

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
    <>
      <CreateAppDialog logic={duplicateAppDialogLogic} />
      <RenameAppDialog logic={renameAppDialogLogic} />
      <DeleteAppDialog logic={deleteAppDialogLogic} />
      <ExportAppDialog logic={exportAppDialogLogic} />

      <PageLayout
        header={
          <TopBar pathItems={[breadcrumbId ?? section]}>
            <div />
            <div className={styles['actions']}>
              {showSearchField && (
                <SearchField
                  placeholder={formatMessage(messages.searchExamples)}
                  label={formatMessage(messages.searchExamples)}
                  onChange={(value: string): void => {
                    setSearchInput(value);
                    // emptying the field (or the clear button) restores the full list
                    if (value === '') setSearchQuery('');
                  }}
                  onSubmit={setSearchQuery}
                  value={searchInput}
                  classes={{
                    container: styles['search-container'],
                    input: styles['search-input'],
                  }}
                />
              )}
              {section === 'my-apps' && (
                <AppActionsMenu
                  onCreateApp={openCreateAppDialog}
                  onImportApp={openImportAppDialog}
                  useStaticPosition
                  title={formatMessage(messages.actionCreate)}
                  classes={{
                    dropdownMenu: styles['dropdown-menu'],
                    dropdownMenuButtonWrapper:
                      styles['dropdown-menu-button-wrapper'],
                  }}
                  buttonChildren={(
                    buttonProps,
                    buttonRef,
                  ): React.ReactElement => (
                    <Button
                      {...buttonProps}
                      ref={buttonRef}
                      variant={ButtonVariant.Primary}
                      size={ButtonSize.XSmall}
                      Icon={Plus}
                      iconPosition="right"
                    >
                      {formatMessage(messages.actionCreate)}
                    </Button>
                  )}
                />
              )}
            </div>
          </TopBar>
        }
      >
        {!appsLoading && apps.length === 0 && (
          <EmptyState
            icon={<NavigationGroup />}
            title={formatMessage(emptyTitleMessages[emptyKey])}
            description={formatMessage(emptyDescriptionMessages[emptyKey])}
          />
        )}

        {!appsLoading && isSearching && filteredApps.length === 0 && (
          <EmptyState
            icon={<NavigationGroup />}
            title={formatMessage(emptyTitleMessages[emptyKey])}
            description={formatMessage(emptySearchMessages.examples)}
          />
        )}

        <div className={styles['my-apps']}>
          {appsLoading && <Card variant="skeleton" />}

          {!appsLoading &&
            filteredApps.length > 0 &&
            filteredApps.map((app, i) => (
              <div
                key={app.id || i}
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
      </PageLayout>
    </>
  );
};

export default AppList;
