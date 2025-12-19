import { ArduinoLogo, InfoIconI } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import BoardSection from '../app-lab-footer-bar/sub-components/board-section/BoardSection';
import { useI18n } from '../i18n/useI18n';
import { useTooltip } from '../tooltip';
import { Large, XSmall } from '../typography';
import { setupMessages, tooltipMessages, welcomeMessages } from './messages';
import SectionContainer from './sections/SectionContainer';
import styles from './setup.module.scss';
import {
  AppLabSetupItemId,
  SetupContentLogicMap,
  UseSetupLogic,
} from './setup.type';
import { sections, setupItems } from './setupSpec';
import Welcome from './sub-components/Welcome';

interface SetupProps {
  setupLogic: UseSetupLogic;
}

const Setup: React.FC<SetupProps> = (props: SetupProps) => {
  const { setupLogic } = props;
  const {
    contentLogicMap,
    currentStep,
    stepIsSkippable,
    boards,
    selectBoard,
    isBoard,
    showBoardSelectionPage,
    showPostSelectionSetup,
    showBoardConnPswPrompt,
    onConnPswCancel,
    onConnPswSubmit,
    isBoardConnectingOrChecking,
    connToBoardError,
    showConfirmButton = true,
    boardItem,
    onOpenTerminal,
    terminalError,
  } = setupLogic();

  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(tooltipMessages.tooltipContent),
    title: formatMessage(tooltipMessages.tooltipTitle),
  });

  return showBoardSelectionPage ? (
    <Welcome
      isLoading={isBoard === undefined}
      boards={boards}
      onSelectBoard={selectBoard}
      showBoardConnPswPrompt={showBoardConnPswPrompt}
      onConnPswCancel={onConnPswCancel}
      onConnPswSubmit={onConnPswSubmit}
      isBoardConnectingOrChecking={isBoardConnectingOrChecking}
      connToBoardError={connToBoardError}
    />
  ) : showPostSelectionSetup ? (
    <div className={styles['setup-container']}>
      <div className={styles['setup-side-panel']}>
        <div className={styles['side-panel-content']}>
          <ArduinoLogo className={styles['arduino-logo']} />
          <Large bold className={styles['title']}>
            {formatMessage(welcomeMessages.title)}
          </Large>
          <ol className={styles['items-list']}>
            {setupItems.map((item) =>
              item.enabled ? (
                <li
                  key={item.id}
                  className={clsx(styles['item'], {
                    [styles['selected']]: item.id === currentStep,
                    [styles['completed']]: currentStep && item.id < currentStep,
                  })}
                >
                  <XSmall bold={item.id === currentStep}>
                    {formatMessage(setupMessages[item.id])}
                  </XSmall>
                  {item.id === AppLabSetupItemId.NetworkSetup ? (
                    <div {...tooltipProps}>
                      <div className={styles['info-icon']}>
                        <InfoIconI />
                      </div>
                      {renderTooltip(styles['tooltip-content'])}
                    </div>
                  ) : null}
                </li>
              ) : null,
            )}
          </ol>
        </div>
        <div className={styles['footer-board-section']}>
          <BoardSection
            boardItem={boardItem}
            isBoard={isBoard}
            onOpenTerminal={onOpenTerminal}
            terminalError={terminalError}
          />
        </div>
      </div>
      <div className={styles['setup-content']}>
        <SectionContainer
          key={currentStep}
          currentStep={currentStep as AppLabSetupItemId}
          itemsLength={setupItems.length}
          skippable={stepIsSkippable}
          renderSection={sections[currentStep as AppLabSetupItemId]}
          sectionLogic={
            (contentLogicMap as SetupContentLogicMap)[
              currentStep as AppLabSetupItemId
            ]
          }
          showConfirmButton={showConfirmButton}
        />
      </div>
    </div>
  ) : null;
};

export default Setup;
