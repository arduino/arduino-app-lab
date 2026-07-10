import { Terminal } from '@cloud-editor-mono/images/assets/icons';

import { XXSmall } from '../../../typography';
import {
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../essential/button';
import { IconButton } from '../essential/icon-button';
import styles from './board-section.module.scss';
import { BoardSectionProps } from './BoardSection.type';
import BoardSelection from './sub-components/board-selection/BoardSelection';

const BoardSection: React.FC<BoardSectionProps> = (
  props: BoardSectionProps,
) => {
  const {
    boardItem,
    isBoard,
    boards,
    selectedBoard,
    selectBoard,
    onOpenTerminal,
    terminalError,
    linuxCredentialsDialog,
  } = props;

  const handleOpenTerminal = async (): Promise<void> => {
    if (!onOpenTerminal) return;

    await onOpenTerminal();
  };

  return (
    <div className={styles['container']}>
      <BoardSelection
        boardItem={boardItem}
        boards={boards}
        isBoard={isBoard}
        selectedBoard={selectedBoard}
        selectBoard={selectBoard}
        linuxCredentialsDialog={linuxCredentialsDialog}
      />
      {!isBoard && (
        <IconButton
          Icon={Terminal}
          size={ButtonSize.XSmall}
          variant={ButtonVariant.Secondary}
          appearance={ButtonAppearance.LowContrast}
          onClick={handleOpenTerminal}
          label={"Connect to the board's shell"}
        />
      )}
      <div className={styles['terminal-error-container']}>
        {terminalError && (
          <XXSmall
            title={terminalError}
            bold
            className={styles['terminal-error']}
          >
            {terminalError}
          </XXSmall>
        )}
      </div>
    </div>
  );
};

export default BoardSection;
