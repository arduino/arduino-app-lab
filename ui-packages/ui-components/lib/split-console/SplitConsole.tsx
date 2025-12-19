import React, { memo, useCallback, useRef, useState } from 'react';
import ReactSplit from 'react-split';

import ConsolePanel from '../console-panel/ConsolePanel';
import { ConsolePanelLogic } from '../console-panel/consolePanel.type';
import styles from './split-console.module.scss';

const ConsolePanelMemo = memo(ConsolePanel);

interface SplitConsoleProps {
  consolePanelLogic: ConsolePanelLogic;
  children: React.ReactNode;
}

const STATUS_BAR_HEIGHT = parseInt(styles.consoleStatusBarHeight);
const GUTTER_HEIGHT = parseInt(styles.consoleGutterHeight);

const SMALL_VALUE = 0.0001;
const CONSOLE_CONTENT_HEIGHT_THRESHOLD = 5;
const INITIAL_SIZES: [number, number] = [60, 40];

const SplitConsole: React.FC<SplitConsoleProps> = (
  props: SplitConsoleProps,
) => {
  const { consolePanelLogic, children } = props;
  const [sizes, setSizes] = useState<[number, number]>(INITIAL_SIZES);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const splitRef = useRef<any>(null);

  /*
    Since react-split provides the height of the split section in percentage,
    we need to calculate the height of the console content in pixels.
    To do that, we multiply the height of the split container by the percentage
    of the console panel split section; then we subtract the height of the
    status bar from the height of the console content.
    
    Since the calculated height is not precise, we need to compare it with a
    threshold value (5px). If the calculated height is less than or equal to
    the threshold value, we consider the console content as collapsed.
  */
  const isMinSize = useCallback(
    (d = sizes[1]): boolean => {
      if (!splitRef?.current || !splitRef?.current?.parent) return false;
      const consoleContentHeight =
        (splitRef.current.parent.clientHeight * d) / 100 - STATUS_BAR_HEIGHT;
      return consoleContentHeight <= CONSOLE_CONTENT_HEIGHT_THRESHOLD;
    },
    [sizes],
  );

  const onResizeEnd: (sizes: number[]) => void = ([t, d]) => {
    if (!isConsoleCollapsed) {
      setSizes([t, d]);
      if (isMinSize(d)) {
        setIsConsoleCollapsed(true);
        return;
      }
    }
    if (!isMinSize(d)) {
      setIsConsoleCollapsed(false);
    }
  };
  const gutterClass = styles.gutter;

  const onCollapse = useCallback((): void => {
    if (isConsoleCollapsed) {
      setIsConsoleCollapsed(false);
      if (isMinSize()) setSizes(INITIAL_SIZES);
      /*
        This is a workaround because the sizes don't change, react-split
        wouldn't know that the console panel should be expanded to the previous
        size. So we need to change the sizes a little bit to force react-split
        to update the sizes.
      */ else setSizes([sizes[0] - SMALL_VALUE, sizes[1] + SMALL_VALUE]);
    } else {
      setIsConsoleCollapsed(true);
    }
  }, [isConsoleCollapsed, isMinSize, sizes]);

  return (
    <ReactSplit
      onDragEnd={onResizeEnd}
      className={styles['split-console']}
      direction="vertical"
      sizes={sizes}
      minSize={[100, STATUS_BAR_HEIGHT]}
      /*
        We need to set the gutter size to 0 because its position is absolute
        and it overlaps the console panel. Then we set the gutter style to
        make sure the gutter is still interactive when hovered.
      */
      gutterSize={0}
      gutterStyle={(): Partial<CSSStyleDeclaration> => ({
        height: `${GUTTER_HEIGHT}px`,
      })}
      // 1 is the index of the console panel section
      collapsed={isConsoleCollapsed ? 1 : undefined}
      gutter={(): HTMLElement => {
        const gutter = document.createElement('div');
        gutter.className = gutterClass;
        gutter.ariaHidden = 'true';
        return gutter;
      }}
      ref={splitRef}
    >
      <div>{children}</div>
      <div>
        <ConsolePanelMemo
          consolePanelLogic={consolePanelLogic}
          onCollapse={onCollapse}
          statusBarHeight={STATUS_BAR_HEIGHT}
          isCollapsed={isConsoleCollapsed}
        />
      </div>
    </ReactSplit>
  );
};

export default SplitConsole;
