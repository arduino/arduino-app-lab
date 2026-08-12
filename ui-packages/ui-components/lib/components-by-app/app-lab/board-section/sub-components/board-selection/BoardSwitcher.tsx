import {
  Checkmark,
  UsbPort,
  Wifi,
} from '@cloud-editor-mono/images/assets/icons';
import { Key, useCallback } from 'react';

import { DropdownMenuButton } from '../../../../../essential/dropdown-menu';
import { useI18n } from '../../../../../i18n/useI18n';
import { Board } from '../../../setup';
// the panel/rows are the footer's actual popup styles, reused verbatim (not re-implemented)
import panelStyles from './board-selection.module.scss';
import { messages } from './messages';

// Shared board-list popup: the footer's BoardSelection and the sidebar's
// BoardItem both open this exact panel; only the trigger button differs
export interface BoardSwitcherClasses {
  dropdownMenuButtonWrapper?: string;
  dropdownMenuButton?: string;
  dropdownMenuButtonOpen?: string;
}

export interface BoardSwitcherProps {
  boards: Board[];
  selectedBoard: Board | undefined;
  selectBoard: (board: Board) => void | Promise<void>;
  buttonChildren: React.ReactNode;
  // native tooltip/accessible name for the trigger button (e.g. "Switch board")
  title?: string;
  useStaticPosition?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  classes?: BoardSwitcherClasses;
}

export const BoardSwitcher: React.FC<BoardSwitcherProps> = ({
  boards,
  selectedBoard,
  selectBoard,
  buttonChildren,
  title,
  useStaticPosition,
  onOpenChange,
  classes,
}: BoardSwitcherProps) => {
  const { formatMessage } = useI18n();

  const isSelectedBoard = useCallback(
    (board: Board) => board.serial === selectedBoard?.serial,
    [selectedBoard],
  );

  const getBoardIcon = useCallback(
    (board: Board) => {
      if (isSelectedBoard(board)) {
        return <Checkmark />;
      }
      return board.connectionType === 'Network' ? <Wifi /> : <UsbPort />;
    },
    [isSelectedBoard],
  );

  const onDropdownAction = useCallback(
    (key: Key) => {
      const board = boards.find((board) => board.serial === key);
      if (!board || isSelectedBoard(board)) {
        return;
      }
      selectBoard(board);
    },
    [boards, isSelectedBoard, selectBoard],
  );

  return (
    <DropdownMenuButton
      title={title}
      useStaticPosition={useStaticPosition}
      sections={[
        {
          name: 'Boards',
          items: boards.length
            ? boards.map((board) => ({
                id: board.serial,
                label: `${board.type}`,
                node: (
                  <>
                    <div
                      className={panelStyles['dropdown-menu-item-label-prefix']}
                    >
                      {getBoardIcon(board)}
                      <span
                        className={
                          panelStyles['dropdown-menu-item-label-prefix-text']
                        }
                        title={board.name}
                      >
                        {board.name}
                      </span>
                    </div>
                    <span
                      className={panelStyles['dropdown-menu-item-type']}
                      title={board.type}
                    >
                      {board.type}
                    </span>
                  </>
                ),
                itemClassName: isSelectedBoard(board)
                  ? panelStyles['is-selected']
                  : undefined,
              }))
            : [
                {
                  id: 'no-boards',
                  label: formatMessage(
                    messages.switchBoardDropdownMenuItemNoBoards,
                  ),
                  itemClassName: panelStyles['no-boards'],
                },
              ],
        },
      ]}
      buttonChildren={buttonChildren}
      onAction={onDropdownAction}
      onOpen={onOpenChange}
      classes={{
        dropdownMenuButtonWrapper: classes?.dropdownMenuButtonWrapper,
        dropdownMenuButton: classes?.dropdownMenuButton,
        dropdownMenuButtonOpen: classes?.dropdownMenuButtonOpen,
        dropdownMenu: panelStyles['dropdown-menu'],
        dropdownMenuItem: panelStyles['dropdown-menu-item'],
        dropdownMenuPopover: panelStyles['dropdown-menu-popover'],
      }}
    />
  );
};
