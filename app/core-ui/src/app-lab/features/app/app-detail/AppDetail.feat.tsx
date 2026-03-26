import { Duplicate } from '@cloud-editor-mono/images/assets/icons';
import {
  AppAction,
  AppTitle,
  Button,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  ConfigureAppBricksDialog,
  MultipleConsolePanel,
  RuntimeActions,
  SwapRunningAppDialog,
  Tabs,
  TopBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import { AppsSection } from '../app.type';
import styles from './app-detail.module.scss';
import { useAppDetailLogic } from './appDetail.logic';
import { useAppDetailRuntimeLogic } from './appDetailRuntime.logic';
import { useCreateAppTitleLogic } from './appDetailTitle.logic';
import { appDetailMessages as messages } from './messages';
import AppFilesSection from './sub-components/AppFilesSection.feat';

interface AppDetailProps {
  appId: string;
  section: AppsSection;
}

const AppDetail: React.FC<AppDetailProps> = (props: AppDetailProps) => {
  const { appId, section } = props;
  const {
    app,
    appBricks,
    appLibraries,
    bricks,
    fileTree,
    selectedFile,
    selectedNode,
    defaultOpenFoldersState,
    openApp,
    updateApp,
    setSelectedFile,
    openFilesFolder,
    openExternal,
    openExternalLink,
    addAppBrick,
    removeAppBrick,
    updateAppBrick,
    updateAppBricks,
    editorLogicParams,
    addFileHandler,
    renameFileHandler,
    deleteFileHandler,
    addSketchLibraryDialogLogic,
    openAddSketchLibraryDialog,
    deleteSketchLibrary,
    addFolderHandler,
  } = useAppDetailLogic(appId, section);

  const { formatMessage } = useI18n();

  const {
    activePanel,
    tabsLogic,
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
  } = useAppDetailRuntimeLogic(
    app,
    appBricks,
    fileTree,
    openApp,
    updateApp,
    updateAppBricks,
  );
  const { appStatus } = runtimeActionsLogic();

  const appTitleLogic = useCreateAppTitleLogic(
    app,
    appStatus,
    section,
    updateApp,
  );
  const { onAppAction } = appTitleLogic();

  return (
    <section className={styles['main']}>
      <ConfigureAppBricksDialog logic={configureAppBricksDialogLogic} />
      <SwapRunningAppDialog logic={swapRunningAppDialogLogic} />
      <TopBar
        pathItems={[
          section,
          <AppTitle key="app-title" appTitleLogic={appTitleLogic} />,
        ]}
      >
        <Tabs tabsLogic={tabsLogic} />
        <div className={styles['actions']}>
          {app?.id && (
            <RuntimeActions
              runtimeActionsLogic={runtimeActionsLogic}
              runtimeDisable={!fileTree}
            />
          )}
          {app?.example && (
            <Button
              onClick={(): void => onAppAction(AppAction.Duplicate)}
              type={ButtonType.Secondary}
              size={ButtonSize.Small}
              Icon={Duplicate}
              variant={ButtonVariant.Action}
              title="Copy and edit app"
              classes={{
                button: styles['actions--duplicate'],
                textButtonText: styles['actions--duplicate-text'],
              }}
            >
              {formatMessage(messages.copyAndEditButton)}
            </Button>
          )}
        </div>
      </TopBar>
      <div
        className={clsx(styles['editor-panel'], {
          [styles['hidden']]: activePanel !== 'editor',
        })}
      >
        <AppFilesSection
          app={app}
          section={section}
          appBricks={appBricks}
          bricks={bricks}
          appLibraries={appLibraries}
          fileTree={fileTree}
          selectedFile={selectedFile}
          selectedNode={selectedNode}
          defaultOpenFoldersState={defaultOpenFoldersState}
          setSelectedFile={setSelectedFile}
          openFilesFolder={openFilesFolder}
          openExternal={openExternal}
          openExternalLink={openExternalLink}
          addAppBrick={addAppBrick}
          deleteAppBrick={removeAppBrick}
          updateAppBrick={updateAppBrick}
          editorLogicParams={editorLogicParams}
          addFileHandler={addFileHandler}
          renameFileHandler={renameFileHandler}
          deleteFileHandler={deleteFileHandler}
          addSketchLibraryDialogLogic={addSketchLibraryDialogLogic}
          openAddSketchLibraryDialog={openAddSketchLibraryDialog}
          deleteSketchLibrary={deleteSketchLibrary}
          addFolderHandler={addFolderHandler}
        />
      </div>
      <div
        className={clsx(styles['multiple-console'], {
          [styles['hidden']]: activePanel !== 'console',
        })}
      >
        <MultipleConsolePanel
          multipleConsolePanelLogic={multipleConsolePanelLogic}
        />
      </div>
    </section>
  );
};

export default AppDetail;
