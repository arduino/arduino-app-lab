/**
 * Unit tests for the split-drag integration in useTabsBarReorder.
 *
 * Focus: the contract between the tab drag lifecycle and the optional
 * `splitDrag` adapter —
 *  - completed drags call `onEnd`, and a consumed drop skips tab reorder;
 *  - cancelled drags (Escape / interrupted activation) call `onCancel`,
 *    never `onEnd`, so an aborted drag can never commit a cross-pane move;
 *  - drag moves report viewport pointer coordinates via `onMove`.
 *
 * dnd-kit events are fabricated as minimal objects; activator events use
 * MouseEvent so the `instanceof` guards short-circuit without relying on
 * PointerEvent being available in the test environment.
 */

import type {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectableFileData } from '../EditorTabsBar.type';
import { useTabsBarReorder } from './useTabsBarReorder';

const makeTab = (id: string): SelectableFileData => ({
  fileId: id,
  fileFullName: `${id}.ino`,
  fileName: id,
  fileExtension: 'ino',
  tags: [],
});

const tabs = [makeTab('tab-a'), makeTab('tab-b'), makeTab('tab-c')];

const makeSplitDrag = (
  consumed = false,
): {
  onStart: ReturnType<typeof vi.fn>;
  onMove: ReturnType<typeof vi.fn>;
  onEnd: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
} => ({
  onStart: vi.fn(),
  onMove: vi.fn(),
  onEnd: vi.fn(() => consumed),
  onCancel: vi.fn(),
});

const startEvent = (id: string): DragStartEvent =>
  ({ active: { id } } as unknown as DragStartEvent);

const endEvent = (
  activeId: string,
  overId: string | null,
  clientX = 0,
): DragEndEvent =>
  ({
    active: { id: activeId },
    over: overId
      ? { id: overId, rect: { left: 0, width: 100, top: 0, height: 30 } }
      : null,
    activatorEvent: new MouseEvent('mousedown', { clientX, clientY: 0 }),
    delta: { x: 0, y: 0 },
  } as unknown as DragEndEvent);

const moveEvent = (
  clientX: number,
  clientY: number,
  delta: { x: number; y: number },
): DragMoveEvent =>
  ({
    active: { id: 'tab-a' },
    over: null,
    activatorEvent: new MouseEvent('mousedown', { clientX, clientY }),
    delta,
  } as unknown as DragMoveEvent);

describe('useTabsBarReorder — split-drag integration', () => {
  it('forwards drag start to the split context with the dragged file id', () => {
    const splitDrag = makeSplitDrag();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder: vi.fn(), splitDrag }),
    );

    act(() => {
      result.current.handleDragStart(startEvent('tab-a'));
    });

    expect(splitDrag.onStart).toHaveBeenCalledWith('tab-a');
  });

  it('reports pointer coordinates (activator + delta) on drag move', () => {
    const splitDrag = makeSplitDrag();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder: vi.fn(), splitDrag }),
    );

    act(() => {
      result.current.handleDragStart(startEvent('tab-a'));
    });
    act(() => {
      result.current.handleDragMove(moveEvent(10, 20, { x: 5, y: 7 }));
    });

    expect(splitDrag.onMove).toHaveBeenCalledWith({ x: 15, y: 27 });
  });

  it('reports the real pointer position over activator + delta once a live pointer event is seen', () => {
    // dnd-kit's `delta` bakes in scroll compensation, so `activator + delta`
    // drifts when the source bar auto-scrolls. A captured live pointer event
    // must take precedence to keep the cross-pane indicator aligned.
    const splitDrag = makeSplitDrag();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder: vi.fn(), splitDrag }),
    );

    act(() => {
      result.current.handleDragStart(startEvent('tab-a'));
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 200, clientY: 50 }),
      );
    });
    act(() => {
      // Activator + delta would report { x: 99, y: 99 }; the live pointer wins.
      result.current.handleDragMove(moveEvent(10, 20, { x: 89, y: 79 }));
    });

    expect(splitDrag.onMove).toHaveBeenLastCalledWith({ x: 200, y: 50 });
  });

  it('a drop consumed by the split zone skips tab reorder', () => {
    const splitDrag = makeSplitDrag(true);
    const updateTabOrder = vi.fn();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder, splitDrag }),
    );

    act(() => {
      result.current.handleDragStart(startEvent('tab-a'));
    });
    act(() => {
      result.current.handleDragEnd(endEvent('tab-a', 'tab-b', 90));
    });

    expect(splitDrag.onEnd).toHaveBeenCalledTimes(1);
    expect(updateTabOrder).not.toHaveBeenCalled();
  });

  it('an unconsumed drop falls through to tab reorder', () => {
    const splitDrag = makeSplitDrag(false);
    const updateTabOrder = vi.fn();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder, splitDrag }),
    );

    act(() => {
      result.current.handleDragStart(startEvent('tab-a'));
    });
    act(() => {
      result.current.handleDragEnd(endEvent('tab-a', 'tab-b', 90));
    });

    expect(splitDrag.onEnd).toHaveBeenCalledTimes(1);
    expect(updateTabOrder).toHaveBeenCalledTimes(1);
    const [newOrder, draggedId] = updateTabOrder.mock.calls[0];
    expect(draggedId).toBe('tab-a');
    expect([...newOrder].sort()).toEqual(['tab-a', 'tab-b', 'tab-c']);
  });

  it('does not call onEnd for a drag that never produced an onStart', () => {
    const splitDrag = makeSplitDrag();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder: vi.fn(), splitDrag }),
    );

    act(() => {
      result.current.handleDragEnd(endEvent('tab-a', null));
    });

    expect(splitDrag.onEnd).not.toHaveBeenCalled();
  });

  describe('cancelled drags', () => {
    it('tears down via onCancel and never calls onEnd (no drop commit on Escape)', () => {
      const splitDrag = makeSplitDrag();
      const updateTabOrder = vi.fn();
      const { result } = renderHook(() =>
        useTabsBarReorder({ tabs, updateTabOrder, splitDrag }),
      );

      act(() => {
        result.current.handleDragStart(startEvent('tab-a'));
      });
      act(() => {
        result.current.handleDragCancel();
      });

      expect(splitDrag.onCancel).toHaveBeenCalledTimes(1);
      expect(splitDrag.onEnd).not.toHaveBeenCalled();
      expect(updateTabOrder).not.toHaveBeenCalled();
    });

    it('does not call onCancel when no drag was started', () => {
      const splitDrag = makeSplitDrag();
      const { result } = renderHook(() =>
        useTabsBarReorder({ tabs, updateTabOrder: vi.fn(), splitDrag }),
      );

      act(() => {
        result.current.handleDragCancel();
      });

      expect(splitDrag.onCancel).not.toHaveBeenCalled();
    });

    it('a new drag after a cancel starts cleanly', () => {
      const splitDrag = makeSplitDrag();
      const { result } = renderHook(() =>
        useTabsBarReorder({ tabs, updateTabOrder: vi.fn(), splitDrag }),
      );

      act(() => {
        result.current.handleDragStart(startEvent('tab-a'));
      });
      act(() => {
        result.current.handleDragCancel();
      });
      act(() => {
        result.current.handleDragStart(startEvent('tab-b'));
      });
      act(() => {
        result.current.handleDragEnd(endEvent('tab-b', null));
      });

      expect(splitDrag.onStart).toHaveBeenLastCalledWith('tab-b');
      // The second drag completed normally, so onEnd fires exactly once.
      expect(splitDrag.onEnd).toHaveBeenCalledTimes(1);
      expect(splitDrag.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  it('works without a splitDrag adapter (reorder only)', () => {
    const updateTabOrder = vi.fn();
    const { result } = renderHook(() =>
      useTabsBarReorder({ tabs, updateTabOrder }),
    );

    act(() => {
      result.current.handleDragStart(startEvent('tab-a'));
    });
    act(() => {
      result.current.handleDragEnd(endEvent('tab-a', 'tab-b', 90));
    });

    expect(updateTabOrder).toHaveBeenCalledTimes(1);
    expect(() =>
      act(() => {
        result.current.handleDragCancel();
      }),
    ).not.toThrow();
  });
});
