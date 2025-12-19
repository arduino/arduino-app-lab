import { ShareSketchIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useRef } from 'react';
import { useButton, useMenuTrigger } from 'react-aria';
import { useMenuTriggerState } from 'react-stately';

import { DropdownMenuPopover } from '../../../essential/dropdown-menu';
import dropdownStyles from '../../../essential/dropdown-menu/dropdown-menu.module.scss';
import { ShareSketchLogic, ShareToClassroomLogic } from '../../Toolbar.type';
import styles from './share-sketch.module.scss';
import { ShareSketch } from './ShareSketch';

interface ShareSketchButtonProps {
  shareSketchLogic: ShareSketchLogic;
  shareToClassroomLogic: ShareToClassroomLogic;
}

export function ShareSketchButton(props: ShareSketchButtonProps): JSX.Element {
  const { shareSketchLogic, shareToClassroomLogic } = props;

  const state = useMenuTriggerState({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { menuTriggerProps } = useMenuTrigger({}, state, buttonRef);

  const { buttonProps } = useButton(menuTriggerProps, buttonRef);

  return (
    <div
      className={clsx(
        styles['share-sketch-button-wrapper'],
        dropdownStyles['dropdown-menu-button-wrapper'],
      )}
    >
      <button
        {...buttonProps}
        ref={buttonRef}
        className={clsx(
          styles['share-sketch-button'],
          dropdownStyles['dropdown-menu-button'],
          state.isOpen && [dropdownStyles['dropdown-menu-button-open']],
        )}
      >
        {<ShareSketchIcon />}
      </button>
      {state.isOpen && (
        <DropdownMenuPopover triggerRef={buttonRef} state={state}>
          <ShareSketch
            shareSketchLogic={shareSketchLogic}
            shareToClassroomLogic={shareToClassroomLogic}
          />
        </DropdownMenuPopover>
      )}
    </div>
  );
}
