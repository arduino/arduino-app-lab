import { Terminal } from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../../essential/icon-button';
import { useTooltip } from '../../../tooltip';
import { XXSmall } from '../../../typography';
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
    autoSelectBoard,
    onOpenTerminal,
    terminalError,
  } = props;

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: "Connect to the board's shell",
    direction: 'up',
    timeout: 0,
  });

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
        autoSelectBoard={autoSelectBoard}
      />
      {!isBoard && (
        <div className={styles['tooltip']} {...tooltipProps}>
          <IconButton
            classes={{ button: styles['terminal-button'] }}
            Icon={Terminal}
            onPress={handleOpenTerminal}
            label={'Terminal'}
          />
          {renderTooltip(styles['tooltip-content'])}
        </div>
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
