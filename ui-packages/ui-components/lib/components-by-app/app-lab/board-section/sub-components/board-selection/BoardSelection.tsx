import {
  CaretDown,
  Checkmark,
  UsbPort,
  Wifi,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { Key, useCallback, useState } from 'react';

import { LinuxCredentialsDialog } from '../../../../../dialogs';
import { DropdownMenuButton } from '../../../../../essential/dropdown-menu';
import { useI18n } from '../../../../../i18n/useI18n';
import { useTooltip } from '../../../../../tooltip';
import { Board } from '../../../setup';
import styles from './board-selection.module.scss';
import { BoardSelectionProps } from './BoardSelection.type';
import { messages } from './messages';

const BoardSelection: React.FC<BoardSelectionProps> = ({
  boardItem,
  boards,
  selectedBoard,
  isBoard,
  selectBoard,
  linuxCredentialsDialog,
}: BoardSelectionProps) => {
  const { label, state = 'inactive', icon } = boardItem ?? {};

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { formatMessage } = useI18n();

  const { props: tooltipPropsLabel, renderTooltip: renderTooltipLabel } =
    useTooltip({
      content: label,
      direction: 'up',
      timeout: 0,
    });

  const {
    props: tooltipPropsDropdown,
    renderTooltip: renderTooltipDropdown,
    setShowTooltip: setShowTooltipDropdown,
  } = useTooltip({
    content: formatMessage(messages.switchBoardDropdownButton),
    direction: 'up',
    timeout: 0,
  });

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
      const board = boards.find((board) => board.serial === key)!;
      if (!board || isSelectedBoard(board)) {
        return;
      }
      selectBoard(board);
    },
    [boards, isSelectedBoard, selectBoard],
  );

  return (
    <div className={clsx(styles['container'], styles[state])}>
      <div className={styles['selected-board']}>
        {/* icon */}
        {icon ? icon : null}
        {/* label */}
        <span
          className={clsx(styles['label'], styles['tooltip-container'])}
          {...tooltipPropsLabel}
        >
          {label ? label : formatMessage(messages.notConnected)}
          {renderTooltipLabel(styles['tooltip-content--label'])}
        </span>
      </div>

      {/* switch board dropdown */}
      {!isBoard && (
        <div className={styles['tooltip-container']} {...tooltipPropsDropdown}>
          <DropdownMenuButton
            useStaticPosition={false}
            sections={[
              {
                name: 'Boards',
                items: boards.length
                  ? boards.map((board) => ({
                      id: board.serial,
                      label: `${board.type}`,
                      labelPrefix: (
                        <div
                          className={styles['dropdown-menu-item-label-prefix']}
                        >
                          {getBoardIcon(board)}
                          <span
                            className={
                              styles['dropdown-menu-item-label-prefix-text']
                            }
                            title={board.name}
                          >
                            {board.name}
                          </span>
                        </div>
                      ),
                      itemClassName: isSelectedBoard(board)
                        ? styles['is-selected']
                        : undefined,
                    }))
                  : [
                      {
                        id: 'no-boards',
                        label: formatMessage(
                          messages.switchBoardDropdownMenuItemNoBoards,
                        ),
                        itemClassName: styles['no-boards'],
                      },
                    ],
              },
            ]}
            buttonChildren={<CaretDown />}
            onAction={onDropdownAction}
            onOpen={(isOpen): void => {
              setIsDropdownOpen(isOpen);
              setShowTooltipDropdown(false);
            }}
            classes={{
              dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
              dropdownMenuButton: styles['dropdown-menu-button'],
              dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
              dropdownMenu: styles['dropdown-menu'],
              dropdownMenuItem: styles['dropdown-menu-item'],
              dropdownMenuPopover: styles['dropdown-menu-popover'],
            }}
          />
          {renderTooltipDropdown(
            clsx(
              styles['tooltip-content--dropdown'],
              isDropdownOpen && styles['dropdown-open'],
            ),
          )}
        </div>
      )}
      {linuxCredentialsDialog && (
        <LinuxCredentialsDialog logic={linuxCredentialsDialog} />
      )}
    </div>
  );
};

export default BoardSelection;
