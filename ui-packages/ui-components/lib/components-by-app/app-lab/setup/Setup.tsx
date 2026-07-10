import { ArduinoLogo } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { ArduinoLoader } from '../../../essential/loader';
import { useI18n } from '../../../i18n/useI18n';
import { Large, XSmall } from '../../../typography';
import { BoardSection } from '../board-section';
import { setupMessages, welcomeMessages } from './messages';
import SectionContainer from './sections/SectionContainer';
import styles from './setup.module.scss';
import { SetupContentLogicMap, SetupItemId, UseSetupLogic } from './setup.type';
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
    selectedBoard,
    selectingBoard,
    selectBoard,
    isAutoSelectingBoard,
    isBoard,
    showLoader,
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
    onBackStep,
    unlockAutoFlow,
    setupCompleted,
    boardSelectionStatus,
  } = setupLogic();

  const { formatMessage } = useI18n();

  const enabledSetupItems = setupItems.filter((item) => item.enabled);

  return showLoader ? (
    <ArduinoLoader />
  ) : showBoardSelectionPage ? (
    <Welcome
      isLoading={isBoard === undefined}
      boards={boards}
      onSelectBoard={selectBoard}
      showBoardConnPswPrompt={showBoardConnPswPrompt}
      onConnPswCancel={onConnPswCancel}
      onConnPswSubmit={onConnPswSubmit}
      isBoardConnectingOrChecking={isBoardConnectingOrChecking}
      connToBoardError={connToBoardError}
      selectedBoard={selectedBoard}
      selectingBoard={selectingBoard}
      boardSelectionStatus={boardSelectionStatus}
      setupCompleted={setupCompleted}
      isAutoSelectingBoard={isAutoSelectingBoard}
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
            {enabledSetupItems.map((item) => (
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
              </li>
            ))}
          </ol>
        </div>
        <div className={styles['board-section']}>
          <BoardSection
            boardItem={boardItem}
            isBoard={isBoard}
            boards={boards}
            selectedBoard={selectedBoard}
            selectBoard={selectBoard}
            onOpenTerminal={onOpenTerminal}
            terminalError={terminalError}
          />
        </div>
      </div>
      <div className={styles['setup-content']}>
        <SectionContainer
          key={currentStep}
          currentStep={currentStep as SetupItemId}
          itemsLength={enabledSetupItems.length}
          skippable={stepIsSkippable}
          onBack={onBackStep}
          unlockAutoFlow={unlockAutoFlow}
          renderSection={sections[currentStep as SetupItemId]}
          sectionLogic={
            (contentLogicMap as SetupContentLogicMap)[
              currentStep as SetupItemId
            ]
          }
          showConfirmButton={showConfirmButton}
        />
      </div>
    </div>
  ) : null;
};

export default Setup;
