import {
  AppLabSidePanel,
  BoardUpdateDialog,
  ImageWarningDialog,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Themes } from '@cloud-editor-mono/ui-components/themes/theme.type';
import { Outlet } from '@tanstack/react-router';
import { useContext, useEffect } from 'react';

import { ThemeContext } from '../../../common/providers/theme/themeContext';
import { SetupContext } from '../../providers/setup/setupContext';
import { useBoardLifecycleStore } from '../../store/boards/boards';
import FooterBar from '../footer-bar/FooterBar.feat';
import Setup from '../setup/Setup.feat';
import { useMainLogic } from './main.logic';
import styles from './main.module.scss';

const AppLabMain: React.FC = () => {
  const { sidePanelLogic, boardUpdateDialogLogic, imageWarningDialogLogic } =
    useMainLogic();

  const { setupCompleted } = useContext(SetupContext);

  const { setTheme } = useContext(ThemeContext);
  useEffect(() => {
    setTheme(Themes.DarkTheme);
  }, [setTheme]);

  const { boardIsReachable } = useBoardLifecycleStore();

  return (
    <>
      <Setup />
      <BoardUpdateDialog logic={boardUpdateDialogLogic} />
      <ImageWarningDialog logic={imageWarningDialogLogic} />
      {setupCompleted && boardIsReachable ? (
        <>
          <div className={styles['container']}>
            <AppLabSidePanel sidePanelLogic={sidePanelLogic} />
            <div className={styles['outlet']}>
              <Outlet />
            </div>
          </div>

          <FooterBar />
        </>
      ) : null}
    </>
  );
};

export default AppLabMain;
