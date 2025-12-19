import { Duplicate } from '@cloud-editor-mono/images/assets/icons';
import {
  AppAction,
  AppLabAppTitle,
  AppLabTabs,
  AppLabTopBar,
  Button,
  ButtonSize,
  ButtonType,
  ButtonVariant,
  ConfigureAppBricksDialog,
  MultipleConsolePanel,
  RuntimeActions,
  SwapRunningAppDialog,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useState } from 'react';

import { AppsSection } from '../../routes/__root';
import styles from './app-detail.module.scss';
import { useAppDetailLogic } from './appDetail.logic';
import { useAppDetailRuntimeLogic } from './appDetailRuntime.logic';
import { useCreateAppTitleLogic } from './appDetailTitle.logic';
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
    reloadApp,
    setSelectedFile,
    openFilesFolder,
    openExternal,
    openExternalLink,
    addAppBrick,
    loadAppBrick,
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

  const tabs = ['editor', 'console'] as const;
  const [activeTab, setTab] = useState<typeof tabs[number]>('editor');

  const appTitleLogic = useCreateAppTitleLogic(app, section, reloadApp);
  const { onAppAction, onAppDefaultChange } = appTitleLogic();

  const {
    configureAppBricksDialogLogic,
    swapRunningAppDialogLogic,
    multipleConsolePanelLogic,
    runtimeActionsLogic,
  } = useAppDetailRuntimeLogic(
    app,
    appBricks,
    fileTree,
    onAppDefaultChange,
    updateAppBricks,
  );

  return (
    <section className={styles['main']}>
      <ConfigureAppBricksDialog logic={configureAppBricksDialogLogic} />
      <SwapRunningAppDialog logic={swapRunningAppDialogLogic} />
      <AppLabTopBar
        pathItems={[
          section,
          <AppLabAppTitle key="app-title" appTitleLogic={appTitleLogic} />,
        ]}
      >
        <div className={styles['top-bar-container']}>
          <AppLabTabs tabs={tabs} setTab={setTab} activeTab={activeTab} />
          <div className={styles['actions']}>
            {app?.id && (
              <RuntimeActions
                runtimeActionsLogic={runtimeActionsLogic}
                setTab={setTab}
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
                classes={{
                  button: styles['actions--duplicate'],
                }}
              >
                Copy and edit app
              </Button>
            )}
          </div>
        </div>
      </AppLabTopBar>
      {activeTab === 'editor' && (
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
          loadAppBrick={loadAppBrick}
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
      )}
      <div
        className={clsx(styles['multiple-console'], {
          [styles['hidden']]: activeTab !== 'console',
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
