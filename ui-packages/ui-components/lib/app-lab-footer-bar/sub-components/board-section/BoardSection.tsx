import { Terminal } from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../../essential/icon-button';
import { useTooltip } from '../../../tooltip';
import { XXSmall } from '../../../typography';
import { FooterItem } from '../../AppLabFooterBar.type';
import { BoardSelection } from '../board-selection';
import styles from './board-section.module.scss';

interface BoardSectionProps {
  onOpenTerminal?: () => Promise<void>;
  boardItem?: FooterItem;
  isBoard?: boolean;
  terminalError?: string | null;
}

const BoardSection: React.FC<BoardSectionProps> = (
  props: BoardSectionProps,
) => {
  const { boardItem, isBoard, onOpenTerminal, terminalError } = props;

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
    <>
      <BoardSelection name={boardItem?.label} state={boardItem?.state} />

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
    </>
  );
};

export default BoardSection;
