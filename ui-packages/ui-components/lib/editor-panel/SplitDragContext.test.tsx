/**
 * Unit tests for SplitDragContext.
 *
 * Coverage:
 *  - finishDragAtPointer hit-testing against the registered trigger element
 *  - endDrag teardown (a cancelled drag can never commit a drop afterwards)
 *  - the defensive Escape / window-blur teardown listeners
 *  - referential stability of the action context across pointer updates
 *    (pointer moves must only re-render useSplitDragPointer consumers)
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SplitDragPayload,
  SplitDragProvider,
  useSplitDrag,
  useSplitDragPointer,
} from './SplitDragContext';

const PAYLOAD: SplitDragPayload = { fileId: 'file-a', originPane: 'A' };

/** Trigger element whose hit-box is the (0,0)-(100,100) square. */
function makeTriggerEl(): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = (): DOMRect =>
    ({
      left: 0,
      right: 100,
      top: 0,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: (): Record<string, never> => ({}),
    } as DOMRect);
  return el;
}

function renderSplitDrag() {
  return renderHook(
    () => ({ drag: useSplitDrag(), pointer: useSplitDragPointer() }),
    { wrapper: SplitDragProvider },
  );
}

describe('SplitDragContext', () => {
  it('returns null from both hooks outside a provider', () => {
    const { result } = renderHook(() => ({
      drag: useSplitDrag(),
      pointer: useSplitDragPointer(),
    }));

    expect(result.current.drag).toBeNull();
    expect(result.current.pointer).toBeNull();
  });

  describe('finishDragAtPointer', () => {
    it('commits the drop when the pointer is inside the registered trigger', () => {
      const { result } = renderSplitDrag();
      const handler = vi.fn();

      act(() => {
        result.current.drag?.registerTriggerEl(makeTriggerEl());
        result.current.drag?.registerDropHandler(handler);
        result.current.drag?.startDrag(PAYLOAD);
        result.current.drag?.updatePointer({ x: 50, y: 50 });
      });

      let consumed = false;
      act(() => {
        consumed = result.current.drag?.finishDragAtPointer() ?? false;
      });

      expect(consumed).toBe(true);
      expect(handler).toHaveBeenCalledWith(PAYLOAD);
    });

    it('does not commit when the pointer is outside the trigger', () => {
      const { result } = renderSplitDrag();
      const handler = vi.fn();

      act(() => {
        result.current.drag?.registerTriggerEl(makeTriggerEl());
        result.current.drag?.registerDropHandler(handler);
        result.current.drag?.startDrag(PAYLOAD);
        result.current.drag?.updatePointer({ x: 200, y: 200 });
      });

      let consumed = true;
      act(() => {
        consumed = result.current.drag?.finishDragAtPointer() ?? true;
      });

      expect(consumed).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not commit without a registered trigger element', () => {
      const { result } = renderSplitDrag();
      const handler = vi.fn();

      act(() => {
        result.current.drag?.registerDropHandler(handler);
        result.current.drag?.startDrag(PAYLOAD);
        result.current.drag?.updatePointer({ x: 50, y: 50 });
      });

      let consumed = true;
      act(() => {
        consumed = result.current.drag?.finishDragAtPointer() ?? true;
      });

      expect(consumed).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('cannot commit after endDrag — a cancelled drag never drops', () => {
      const { result } = renderSplitDrag();
      const handler = vi.fn();

      act(() => {
        result.current.drag?.registerTriggerEl(makeTriggerEl());
        result.current.drag?.registerDropHandler(handler);
        result.current.drag?.startDrag(PAYLOAD);
        // Pointer parked INSIDE the trigger — the dangerous case.
        result.current.drag?.updatePointer({ x: 50, y: 50 });
      });
      act(() => {
        result.current.drag?.endDrag();
      });

      let consumed = true;
      act(() => {
        consumed = result.current.drag?.finishDragAtPointer() ?? true;
      });

      expect(consumed).toBe(false);
      expect(handler).not.toHaveBeenCalled();
      expect(result.current.drag?.payload).toBeNull();
      expect(result.current.pointer).toBeNull();
    });
  });

  describe('defensive teardown listeners', () => {
    it('Escape clears an active drag', () => {
      const { result } = renderSplitDrag();

      act(() => {
        result.current.drag?.startDrag(PAYLOAD);
        result.current.drag?.updatePointer({ x: 50, y: 50 });
      });
      expect(result.current.drag?.payload).toEqual(PAYLOAD);

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(result.current.drag?.payload).toBeNull();
      expect(result.current.pointer).toBeNull();
    });

    it('window blur clears an active drag', () => {
      const { result } = renderSplitDrag();

      act(() => {
        result.current.drag?.startDrag(PAYLOAD);
      });

      act(() => {
        window.dispatchEvent(new Event('blur'));
      });

      expect(result.current.drag?.payload).toBeNull();
    });
  });

  describe('context value stability', () => {
    it('pointer updates do not rebuild the action context value', () => {
      const { result } = renderSplitDrag();

      act(() => {
        result.current.drag?.startDrag(PAYLOAD);
      });
      const dragValueDuringDrag = result.current.drag;

      act(() => {
        result.current.drag?.updatePointer({ x: 10, y: 10 });
      });
      act(() => {
        result.current.drag?.updatePointer({ x: 20, y: 20 });
      });

      // Action-only consumers (eg. the tabs bars) must not re-render per
      // drag-move frame: the action context value stays the same reference.
      expect(result.current.drag).toBe(dragValueDuringDrag);
      // While the pointer context tracks the latest coordinates.
      expect(result.current.pointer).toEqual({ x: 20, y: 20 });
    });
  });
});
