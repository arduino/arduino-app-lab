import {
  AppLabWelcomeDialog,
  BoardUpdateDialog,
  FlashBoardDialog,
  NetworkSettingsDialog,
  OfflineWarningDialog,
  SidePanel,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Outlet } from '@tanstack/react-router';

import { FlasherFeat } from '../flasher/Flasher.feat';
import FooterBar from '../footer-bar/FooterBar.feat';
import Setup from '../setup/Setup.feat';
import { useMainLogic } from './main.logic';
import styles from './main.module.scss';

const AppLabMain: React.FC = () => {
  const {
    sidePanelLogic,
    boardUpdateDialogLogic,
    flashBoardDialogLogic,
    appLabWelcomeDialogLogic,
    offlineWarningDialogLogic,
    networkSettingsDialogLogic,
    boardsProps,
    boardIsFlashing,
    showRoutes,
  } = useMainLogic();

  return boardIsFlashing ? (
    <FlasherFeat selectBoard={boardsProps.autoSelectBoard} />
  ) : (
    <>
      <Setup boardsProps={boardsProps} />
      <BoardUpdateDialog logic={boardUpdateDialogLogic} />
      <FlashBoardDialog logic={flashBoardDialogLogic} />
      <AppLabWelcomeDialog logic={appLabWelcomeDialogLogic} />
      <OfflineWarningDialog logic={offlineWarningDialogLogic} />
      <NetworkSettingsDialog logic={networkSettingsDialogLogic} />
      {showRoutes ? (
        <>
          <div className={styles['container']}>
            <SidePanel sidePanelLogic={sidePanelLogic} />
            <div className={styles['outlet']}>
              <Outlet />
            </div>
          </div>

          <FooterBar boardsProps={boardsProps} />
        </>
      ) : null}
    </>
  );
};

export default AppLabMain;
