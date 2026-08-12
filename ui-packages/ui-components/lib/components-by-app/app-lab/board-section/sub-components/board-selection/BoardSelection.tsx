import { CaretDown } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useState } from 'react';

import { LinuxCredentialsDialog } from '../../../../../dialogs';
import { useI18n } from '../../../../../i18n/useI18n';
import { useTooltip } from '../../../../../tooltip';
import styles from './board-selection.module.scss';
import { BoardSelectionProps } from './BoardSelection.type';
import { BoardSwitcher } from './BoardSwitcher';
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
          <BoardSwitcher
            boards={boards}
            selectedBoard={selectedBoard}
            selectBoard={selectBoard}
            useStaticPosition={false}
            buttonChildren={<CaretDown />}
            onOpenChange={(isOpen): void => {
              setIsDropdownOpen(isOpen);
              setShowTooltipDropdown(false);
            }}
            classes={{
              dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
              dropdownMenuButton: styles['dropdown-menu-button'],
              dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
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
