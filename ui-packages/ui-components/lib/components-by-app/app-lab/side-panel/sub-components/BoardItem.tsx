import { IconNavigationMenuMoreHorizontal } from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';

import { useI18n } from '../../../../i18n/useI18n';
import { XXSmall, XXXSmall } from '../../../../typography';
// direct file import (not the board-section barrel) to avoid pulling in
// BoardSection's own dialogs/serial-monitor dependency graph at module load
import { BoardSwitcher } from '../../board-section/sub-components/board-selection/BoardSwitcher';
import { useTooltip } from '../../essential/tooltip';
import { Board } from '../../setup';
import BoardIcon from '../../setup/sub-components/BoardIcon';
import { messages } from '../messages';
import styles from './board-item.module.scss';

export interface BoardItemProps {
  board?: Board;
  boards: Board[];
  onSelectBoard: (board: Board) => void;
}

export const BoardItem = ({
  board,
  boards,
  onSelectBoard,
}: BoardItemProps): JSX.Element => {
  const { formatMessage } = useI18n();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const { props: nameTooltipProps, renderTooltip: renderNameTooltip } =
    useTooltip({ content: board?.name });

  const {
    props: switcherTooltipProps,
    renderTooltip: renderSwitcherTooltip,
    setShowTooltip: setShowSwitcherTooltip,
  } = useTooltip({
    content: formatMessage(messages.boardSwitcherTooltip),
  });

  return (
    <div className={styles['board-item']}>
      <button
        className={styles['board-info']}
        onClick={(): void => {
          setIsSwitcherOpen(true);
          setShowSwitcherTooltip(false);
        }}
      >
        <span className={styles['thumbnail']}>
          {board ? <BoardIcon board={board} /> : null}
        </span>
        <span className={styles['text']}>
          <span {...nameTooltipProps} className={styles['text-line']}>
            <XXSmall bold truncate className={styles['name']}>
              {board?.name || formatMessage(messages.noBoardConnectedLabel)}
            </XXSmall>
            {board?.name ? renderNameTooltip() : null}
          </span>
          {board && (
            <span className={styles['text-line']}>
              <XXXSmall truncate className={styles['family']}>
                {board.type}
              </XXXSmall>
            </span>
          )}
        </span>
      </button>
      {/* opens the exact same board-list panel the footer uses; only this trigger button differs */}
      <div
        className={styles['switcher-tooltip-trigger']}
        {...switcherTooltipProps}
      >
        <BoardSwitcher
          boards={boards}
          selectedBoard={board}
          selectBoard={onSelectBoard}
          useStaticPosition={false}
          buttonChildren={<IconNavigationMenuMoreHorizontal />}
          isOpen={isSwitcherOpen}
          onOpenChange={(isOpen): void => {
            setIsSwitcherOpen(isOpen);
            setShowSwitcherTooltip(false);
          }}
          classes={{
            dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
            dropdownMenuButton: styles['dropdown-menu-button'],
            dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
          }}
        />
        {!isSwitcherOpen && renderSwitcherTooltip()}
      </div>
    </div>
  );
};
