import { setCSSVariable } from '@cloud-editor-mono/common';
import { ChevronDown, ChevronUp } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { ReactElement, useRef, useState } from 'react';
import { AriaMenuOptions, useMenu } from 'react-aria';
import { useTreeState } from 'react-stately';
import { useIntersection, useInterval, useMedia } from 'react-use';

import DropdownMenuSection from '../essential/dropdown-menu/DropdownMenuSection';
import styles from './context-menu.module.scss';
import styleVars from './context-menu-variables.module.scss';
import { ContextMenuItemType } from './contextMenu.type';

interface ContextMenuProps extends AriaMenuOptions<ContextMenuItemType> {
  clickPosX?: number;
  clickPosY?: number;
  children: ReactElement | ReactElement[];
}

const contextMenuWidth = Number(styleVars.contextMenuWidth);
const maxContentMenuHeight = Number(styleVars.maxContextMenuHeight);

const ContextMenu: React.FC<ContextMenuProps> = (props: ContextMenuProps) => {
  const { clickPosX, clickPosY, ...restProps } = props;

  const [scrolling, setScrolling] = useState<'top' | 'bottom' | undefined>();

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const topChevronRef = useRef<HTMLDivElement>(null);
  const bottomChevronRef = useRef<HTMLDivElement>(null);

  const topChevronIntersection = useIntersection(topChevronRef, {
    root: scrollRef.current,
    threshold: 1,
  });

  const bottomChevronIntersection = useIntersection(bottomChevronRef, {
    root: scrollRef.current,
    threshold: 1,
  });

  const isShortDevice = useMedia(
    `(max-height: ${styleVars.maxContextMenuHeight}px)`,
  );

  const state = useTreeState<ContextMenuItemType>(restProps);
  const { menuProps } = useMenu<ContextMenuItemType>(restProps, state, listRef);

  const topChevronIsPinned =
    topChevronIntersection && topChevronIntersection.intersectionRatio < 1;

  const bottomChevronIsPinned =
    bottomChevronIntersection &&
    bottomChevronIntersection.intersectionRatio < 1;

  if (clickPosX && clickPosY) {
    const rect = (
      document.getElementById('root') as HTMLElement
    ).getBoundingClientRect();

    const xPositionInBody = clickPosX - rect.left;
    const yPositionInBody = clickPosY - rect.top;

    const spaceToRight = rect.width - xPositionInBody;
    const displaceLeft = spaceToRight < contextMenuWidth ? contextMenuWidth : 0;

    const spaceBelow = rect.height - yPositionInBody;
    const spaceAbove = rect.height - spaceBelow;

    const noSpaceBelow = spaceBelow < maxContentMenuHeight;
    const noSpaceAbove = spaceAbove < maxContentMenuHeight;

    setCSSVariable(
      styles.contextMenuLeft,
      `${xPositionInBody - displaceLeft}px`,
    );

    if (isShortDevice) {
      setCSSVariable(
        styles.contextMenuSquashedHeight,
        /* 
        set in js to allow for rounding, using 80vh in css
        can result in a height of x.x pixels causing
        issues with intersection observer when browser
        is at min height
        */
        `${Math.round(rect.height * 0.8)}px`,
      );
    } else {
      const displaceUp =
        noSpaceBelow && !noSpaceAbove
          ? maxContentMenuHeight
          : noSpaceBelow && noSpaceAbove
          ? spaceAbove
          : 0;

      setCSSVariable(
        styles.contextMenuTop,
        `${yPositionInBody - displaceUp}px`,
      );
    }
  }

  useInterval(
    () => {
      const value = scrolling === 'top' ? -5 : scrolling === 'bottom' ? 5 : 0;

      if (scrollRef.current) {
        scrollRef.current.scrollTop += value;
      }
    },
    scrolling ? 10 : null,
  );

  return (
    <div
      className={clsx(styles['context-menu'], {
        [styles['context-menu-squashed']]: isShortDevice,
      })}
      ref={scrollRef}
    >
      <div
        className={clsx(
          styles['context-menu-chevron'],
          styles['context-menu-chevron-top'],
          { [styles['hidden']]: !topChevronIsPinned },
        )}
        onMouseEnter={(): void => setScrolling('top')}
        onMouseLeave={(): void => setScrolling(undefined)}
        ref={topChevronRef}
      >
        <ChevronUp />
      </div>

      <ul {...menuProps} ref={listRef} className={styles['context-menu-list']}>
        {[...state.collection].map((item) => (
          <DropdownMenuSection key={item.key} section={item} state={state} />
        ))}
      </ul>
      <div
        className={clsx(
          styles['context-menu-chevron'],
          styles['context-menu-chevron-bottom'],
          { [styles['hidden']]: !bottomChevronIsPinned },
        )}
        onMouseEnter={(): void => setScrolling('bottom')}
        onMouseLeave={(): void => setScrolling(undefined)}
        ref={bottomChevronRef}
      >
        <ChevronDown />
      </div>
    </div>
  );
};

export default ContextMenu;
