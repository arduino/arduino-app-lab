import {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SelectableFileData } from '../EditorTabsBar.type';

type UseTabsBarReorder = (params: {
  tabs: SelectableFileData[];
  /**
   * Optional split-drag integration. When provided, the tab @dnd-kit drag
   * also drives the editor split drop zone:
   *  - `onStart(fileId)` is called when a tab drag begins.
   *  - `onMove({x, y})` is called continuously with viewport coords.
   *  - `onEnd()` is called at the end of a completed drag that produced an
   *    `onStart` call and may return `true` if the drop was consumed by the
   *    split zone (in which case reorder is skipped).
   *  - `onCancel()` is called instead of `onEnd()` for aborted drags
   *    (Escape, interrupted activation). It must tear down the split
   *    context's in-flight state WITHOUT attempting to commit a drop.
   */
  splitDrag?: {
    onStart: (fileId: string) => void;
    onMove: (pointer: { x: number; y: number }) => void;
    onEnd: () => boolean;
    onCancel: () => void;
  };
  updateTabOrder: (newOrder: string[], draggedFileId?: string) => void;
}) => {
  activeId: string | null;
  activeTab: SelectableFileData | null;
  dropIndicator: { tabId: string; direction: 'left' | 'right' } | null;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
};

// Implements drag and drop collision logic for vertical tab list
// This allows to evaluate pointer collision also outside of the tab list container
export const verticalColumnCollisionStrategy: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableContainers } = args;

  if (!pointerCoordinates || droppableContainers.length === 0) {
    return [];
  }

  // Sort containers bases on left coordinate to properly
  // detect out of bound dragging on left and right side of the list
  const sortedContainers = [...droppableContainers].sort((a, b) => {
    return (a.rect.current?.left ?? 0) - (b.rect.current?.left ?? 0);
  });

  const firstTab = sortedContainers[0];
  const lastTab = sortedContainers[sortedContainers.length - 1];
  const mouseX = pointerCoordinates.x;

  // If out of bound to the left, match the first tab
  if (mouseX <= (firstTab.rect.current?.left ?? 0)) {
    return [{ id: firstTab.id }];
  }
  // If out of bound to the right, match the last tab
  if (mouseX >= (lastTab.rect.current?.right ?? 0)) {
    return [{ id: lastTab.id }];
  }

  // Find target based on pointer coordinates
  const target = sortedContainers.find((container) => {
    const rect = container.rect.current;
    return rect && mouseX >= rect.left && mouseX <= rect.right;
  });
  if (target) {
    return [{ id: target.id }];
  }

  // Fallback to default behavior
  return rectIntersection(args);
};

export const useTabsBarReorder: UseTabsBarReorder = ({
  tabs,
  updateTabOrder,
  splitDrag,
}) => {
  const [dropIndicator, setDropIndicator] = useState<{
    tabId: string;
    direction: 'left' | 'right';
  } | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  // Tracks whether we successfully told the split context a drag is in
  // progress. Used to gate the matching `onEnd`/`cancel` calls so we don't
  // tear down state that was never set up.
  const splitDragStartedRef = useRef(false);

  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const trackPointer = useCallback((event: PointerEvent | TouchEvent) => {
    const point = 'touches' in event ? event.touches[0] : event;
    if (point) {
      pointerRef.current = { x: point.clientX, y: point.clientY };
    }
  }, []);
  const startPointerTracking = useCallback(
    (activatorEvent: Event) => {
      if (
        activatorEvent instanceof MouseEvent ||
        activatorEvent instanceof PointerEvent
      ) {
        pointerRef.current = {
          x: activatorEvent.clientX,
          y: activatorEvent.clientY,
        };
      }
      window.addEventListener('pointermove', trackPointer, { passive: true });
      window.addEventListener('touchmove', trackPointer, { passive: true });
    },
    [trackPointer],
  );

  const stopPointerTracking = useCallback(() => {
    window.removeEventListener('pointermove', trackPointer);
    window.removeEventListener('touchmove', trackPointer);
    pointerRef.current = null;
  }, [trackPointer]);

  useEffect(() => {
    return () => stopPointerTracking();
  }, [stopPointerTracking]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.fileId === activeId) ?? null,
    [tabs, activeId],
  );

  // Delay pointer sensor event to not override other pointer interactions by dragging
  // eg. button click, context menu
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 1,
    },
  });
  const sensors = useSensors(
    pointerSensor,
    useSensor(KeyboardSensor),
    useSensor(TouchSensor),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      startPointerTracking(event.activatorEvent);
      if (splitDrag) {
        splitDrag.onStart(event.active.id as string);
        splitDragStartedRef.current = true;
      }
    },
    [setActiveId, splitDrag, startPointerTracking],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { activatorEvent, delta, over } = event;

      if (
        activatorEvent instanceof MouseEvent ||
        activatorEvent instanceof PointerEvent
      ) {
        const pointer = pointerRef.current ?? {
          x: activatorEvent.clientX + delta.x,
          y: activatorEvent.clientY + delta.y,
        };
        const mouseX = pointer.x;
        splitDrag?.onMove({ x: pointer.x, y: pointer.y });

        if (over) {
          const overRect = over.rect;
          const midpoint = overRect.left + overRect.width / 2;

          let direction: 'left' | 'right' | null = null;
          if (mouseX > midpoint) {
            direction = 'right';
          }
          if (mouseX < midpoint) {
            direction = 'left';
          }
          setDropIndicator((prev) => ({
            tabId: over.id as string,
            direction: direction || prev?.direction || 'left',
          }));
        }
      }
    },
    [setDropIndicator, splitDrag],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, activatorEvent, delta } = event;
      setDropIndicator(null);
      setActiveId(null);

      const lastPointer = pointerRef.current;
      stopPointerTracking();

      // Only call `onEnd` if we actually told the split context a drag began.
      // This avoids races where a drag without a corresponding start (eg.
      // missed activation) would tear down state that was never set up.
      const consumedBySplit = splitDragStartedRef.current
        ? splitDrag?.onEnd() ?? false
        : false;
      splitDragStartedRef.current = false;
      if (consumedBySplit) {
        return;
      }

      if (over && active.id !== over.id) {
        const oldIndex = tabs.findIndex((tab) => tab.fileId === active.id);
        const overIndex = tabs.findIndex((tab) => tab.fileId === over.id);

        const mouseX =
          lastPointer?.x ??
          (activatorEvent instanceof MouseEvent ||
          activatorEvent instanceof PointerEvent
            ? activatorEvent.clientX
            : 0) + delta.x;

        // Get the midpoint of the tab we are dropping on
        const overRect = over.rect;
        const midpoint = overRect.left + overRect.width / 2;

        let newIndex = overIndex;

        // Logic: If mouse is past the midpoint, we want to land AFTER this item.
        // If mouse is before the midpoint, we want to land BEFORE this item.
        if (mouseX > midpoint && oldIndex < overIndex) {
          // Already moving right, staying at overIndex is correct
          newIndex = overIndex;
        } else if (mouseX < midpoint && oldIndex > overIndex) {
          // Already moving left, staying at overIndex is correct
          newIndex = overIndex;
        } else if (mouseX > midpoint && oldIndex > overIndex) {
          // Moving left but dropped on right half, shift one forward
          newIndex = overIndex + 1;
        } else if (mouseX < midpoint && oldIndex < overIndex) {
          // Moving right but dropped on left half, shift one back
          newIndex = overIndex - 1;
        }
        const newTabList = arrayMove(tabs, oldIndex, newIndex);
        updateTabOrder(
          newTabList.map((tab) => tab.fileId),
          active.id as string,
        );
      }
    },
    [tabs, updateTabOrder, splitDrag, stopPointerTracking],
  );

  // Cancel handler: dnd-kit fires this when the user presses Escape or the
  // drag is otherwise interrupted. Tear down our local state and the split
  // context's in-flight state so the next drag starts cleanly — via
  // `onCancel`, never `onEnd`, so an aborted drag can't commit a drop even
  // when the pointer happens to be inside the drop trigger.
  const handleDragCancel = useCallback(() => {
    setDropIndicator(null);
    setActiveId(null);
    stopPointerTracking();
    if (splitDragStartedRef.current) {
      splitDrag?.onCancel();
      splitDragStartedRef.current = false;
    }
  }, [splitDrag, stopPointerTracking]);

  return {
    activeId,
    activeTab,
    dropIndicator,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
};
