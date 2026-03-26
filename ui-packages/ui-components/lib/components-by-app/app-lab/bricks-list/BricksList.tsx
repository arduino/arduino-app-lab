import { BrickListItem as BrickListItemType } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import { useCallback, useEffect, useRef } from 'react';

import styles from './bricks-list.module.scss';
import { BrickListItem } from './sub-components/brick-list-item/BrickListItem';
import { BricksListItemProps } from './sub-components/brick-list-item/BrickListItem.type';

interface BricksListProps
  extends Omit<BricksListItemProps, 'brick' | 'classes' | 'size'> {
  bricks: BrickListItemType[];
  brickSize?: BricksListItemProps['size'];
  classes?: BricksListItemProps['classes'] & {
    container?: string;
  };
}

const BricksList: React.FC<BricksListProps> = (props: BricksListProps) => {
  const { bricks, brickSize, classes, selectedBrick, onClick } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const brickListItemsRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // focus container on mount to enable onKeyDown events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // keyboard navigation (up, down)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (
        !bricks.length ||
        !selectedBrick ||
        !['ArrowUp', 'ArrowDown'].includes(e.key)
      ) {
        return;
      }

      const currentIndex = bricks.findIndex(
        (brick) => brick.id === selectedBrick.id,
      );

      let nextIndex: number;

      switch (e.key) {
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + 1, bricks.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        default:
          return;
      }

      const nextBrick = bricks[nextIndex];

      if (nextBrick.id === selectedBrick?.id) {
        return;
      }

      const nextBrickRef = brickListItemsRefs.current[nextIndex]!;
      nextBrickRef.focus();
      nextBrickRef.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
      onClick?.(nextBrick);
    },
    [bricks, selectedBrick, onClick],
  );

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listbox"
      ref={containerRef}
      className={clsx(styles['container'], classes?.container)}
    >
      {bricks.map((brick, index) => (
        <BrickListItem
          {...props}
          key={brick.id}
          brick={brick}
          size={brickSize}
          classes={classes}
          ref={(el): HTMLButtonElement | null =>
            (brickListItemsRefs.current[index] = el)
          }
        />
      ))}
    </div>
  );
};

export default BricksList;
