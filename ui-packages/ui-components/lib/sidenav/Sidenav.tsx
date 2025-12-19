import { getCSSVariable, setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import ReactSplit from 'react-split-grid';
import { useMeasure } from 'react-use';

import styles from './sidenav.module.scss';
import { UseSidenavLogic } from './sidenav.type';
import stylesVars from './sidenav-variables.module.scss';
import SidenavContentRoot from './SidenavContentRoot';
import SidenavItems from './SidenavItems';

export interface SidenavProps {
  sidenavLogic: UseSidenavLogic;
  children?: React.ReactNode;
}

const sidenavPanelMinWidth = Number(stylesVars.sidenavPanelMinWidth);
const sidenavPanelMaxWidth = Number(stylesVars.sidenavPanelMaxWidth);

const Sidenav: React.FC<SidenavProps> = (props: SidenavProps) => {
  const { children, sidenavLogic } = props;
  const {
    topSidenavItems,
    bottomSidenavItems,
    activeItem,
    sidenavSharedLogic,
    contentLogicMap,
    headerLogicMap,
    onInteract,
    sectionKey,
    disabledItems,
    initialSidenavWidth,
    onSizeChange,
    isGenAiBannerDismissed,
    sketchExplorerHasBeenOpened,
  } = sidenavLogic();

  const startWidth = useMemo(
    () =>
      initialSidenavWidth
        ? initialSidenavWidth > sidenavPanelMaxWidth
          ? sidenavPanelMaxWidth
          : initialSidenavWidth < sidenavPanelMinWidth
          ? sidenavPanelMinWidth
          : initialSidenavWidth
        : sidenavPanelMinWidth,
    [initialSidenavWidth],
  );

  const [currentSidenavPanelWidth, setCurrentSidenavPanelWidth] =
    useState(startWidth);

  useEffect(() => {
    const value = String(startWidth);
    if (getCSSVariable(stylesVars.initialSidenavPanelWidth) !== value) {
      setCSSVariable(stylesVars.initialSidenavPanelWidth, value);
      setCSSVariable(stylesVars.currentSidenavPanelWidth, `${value}px`);
    }
  }, [startWidth]);

  const [ref, { width: sidenavWidth }] = useMeasure<HTMLDivElement>();

  return (
    <div className={styles['sidenav-container']}>
      <nav className={styles['sidenav']}>
        <SidenavItems
          items={
            disabledItems?.length
              ? topSidenavItems.filter(
                  (item) => !disabledItems.includes(item.id),
                )
              : topSidenavItems
          }
          onInteract={onInteract}
          isGenAiBannerDismissed={isGenAiBannerDismissed}
          sketchExplorerHasBeenOpened={sketchExplorerHasBeenOpened}
        />
        <SidenavItems
          items={bottomSidenavItems}
          onInteract={onInteract}
          isGenAiBannerDismissed={isGenAiBannerDismissed}
          sketchExplorerHasBeenOpened={sketchExplorerHasBeenOpened}
        />
      </nav>
      <ReactSplit
        columnMinSizes={{
          0: sidenavPanelMinWidth,
          2: sidenavWidth - sidenavPanelMaxWidth,
        }}
        onDrag={(
          direction: 'row' | 'column',
          track: number,
          gridTemplateStyle: string,
        ): void => {
          const sidenavPanelWidth = gridTemplateStyle.split(' ')[0];
          setCSSVariable(
            stylesVars.currentSidenavPanelWidth,
            sidenavPanelWidth,
          );
          const sidenavPanelWidthInt = parseInt(sidenavPanelWidth);
          setCurrentSidenavPanelWidth(sidenavPanelWidthInt);
          onSizeChange && onSizeChange(sidenavPanelWidthInt);
        }}
        render={({
          getGridProps,
          getGutterProps,
        }: {
          getGridProps: () => JSX.Element;
          getGutterProps: (type: string, index: number) => JSX.Element;
        }): JSX.Element => (
          <div
            {...getGridProps()}
            ref={ref}
            className={clsx(styles['sidenav-split'], {
              [styles['collapsed']]: !activeItem,
              [styles['sidenav-split-initial']]:
                !!initialSidenavWidth && initialSidenavWidth,
            })}
          >
            {activeItem ? (
              <>
                <SidenavContentRoot
                  sidenavSharedLogic={sidenavSharedLogic}
                  activeItem={activeItem}
                  contentLogicMap={contentLogicMap}
                  headerLogicMap={headerLogicMap}
                  sectionKey={sectionKey}
                  currentSidenavPanelWidth={currentSidenavPanelWidth}
                />
                <div
                  {...getGutterProps('column', 1)}
                  className={styles['gutter']}
                />
              </>
            ) : null}
            <div className={clsx(styles['sidenav-children'])}>{children}</div>
          </div>
        )}
      />
    </div>
  );
};

export default Sidenav;
