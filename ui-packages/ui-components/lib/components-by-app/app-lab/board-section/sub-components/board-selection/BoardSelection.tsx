import {
  CaretDown,
  Checkmark,
  UsbPort,
  Wifi,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { Key, useCallback } from 'react';

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
  autoSelectBoard,
}: BoardSelectionProps) => {
  const { label, state = 'inactive', icon } = boardItem ?? {};

  const { formatMessage } = useI18n();

  const { props: tooltipPropsLabel, renderTooltip: renderTooltipLabel } =
    useTooltip({
      content: label,
      direction: 'up',
      timeout: 0,
    });

  const { props: tooltipPropsDropdown, renderTooltip: renderTooltipDropdown } =
    useTooltip({
      content: formatMessage(messages.switchBoardDropdownButton),
      direction: 'up',
      timeout: 0,
    });

  const isSelectedBoard = useCallback(
    (board: Board) => board.id === selectedBoard?.id,
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
      const board = boards.find((board) => board.id === key)!;
      if (isSelectedBoard(board)) {
        return;
      }
      autoSelectBoard(board.id);
    },
    [boards, isSelectedBoard, autoSelectBoard],
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
                items: boards.map((board) => ({
                  id: board.id,
                  label: `${board.type}`,
                  labelPrefix: (
                    <div className={styles['dropdown-menu-item-label-prefix']}>
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
                })),
              },
            ]}
            buttonChildren={<CaretDown />}
            onAction={onDropdownAction}
            classes={{
              dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
              dropdownMenuButton: styles['dropdown-menu-button'],
              dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
              dropdownMenu: styles['dropdown-menu'],
              dropdownMenuItem: styles['dropdown-menu-item'],
            }}
          />
          {renderTooltipDropdown(styles['tooltip-content--dropdown'])}
        </div>
      )}
    </div>
  );
};

export default BoardSelection;
