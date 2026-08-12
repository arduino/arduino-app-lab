import { useCallback, useEffect, useRef, useState } from 'react';

// Tolerance (px) within which the thread still counts as scrolled to the
// bottom, absorbing sub-pixel rounding so the state doesn't flicker.
const SCROLL_BOTTOM_THRESHOLD = 4;

export interface StickToBottom {
  ref: React.RefObject<HTMLDivElement>;
  atBottom: boolean;
  onScroll: (el: HTMLDivElement) => void;
  // Jump back to the newest content (the scroll-to-bottom button, sending a message).
  scrollToBottom: VoidFunction;
  // Stop following the bottom edge, so a user-driven expand keeps what it revealed in view
  // (handed to the thread's collapsible blocks through AutoScrollProvider).
  pauseAutoScroll: VoidFunction;
}

/**
 * Reports whether the thread sits at its bottom, jumps back there on demand, and holds a
 * scrolled-up reader's place while the content around them changes.
 *
 * Staying at the bottom is the browser's job, not this hook's: the thread is a bottom-anchored
 * scroller (`flex-direction: column-reverse`, newest message first in the DOM), so streaming
 * tokens, async markdown/code rendering, an expanding composer or a resized panel all keep the
 * newest content against the bottom edge on their own. That native anchoring replaced a
 * ResizeObserver that re-pinned by assigning `scrollTop`: WebKit reverts such writes a frame
 * later while the input keeps resizing, which left the thread stranded just above its bottom
 * with the scroll-to-bottom button showing.
 *
 * In a column-reverse scroller the bottom is offset 0 and scrolling up takes the offset negative.
 * That is also why a reader who scrolled up needs help: their offset is measured from the bottom,
 * so anything growing between them and it — streamed tokens, a block they just expanded, a new
 * message — slides what they are reading out of view. The observer below gives the offset that
 * same delta back, which is a scroll write the engine keeps: it answers a settled content change
 * rather than racing a still-resizing element.
 */
export const useStickToBottom = (): StickToBottom => {
  const [atBottom, setAtBottom] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  // Mirrors `atBottom` for the observers, which are wired once and must not go stale.
  const atBottomRef = useRef(true);

  // Scrolling up takes the offset negative (both engines do this in a reversed scroller), so the
  // distance is its negation — not its magnitude: a rubber-band bounce *past* the bottom overshoots
  // the other way, and reading that as distance made the button flash on every trackpad flick.
  const distanceFromBottom = (el: HTMLDivElement): number =>
    Math.max(0, -el.scrollTop);

  const setPosition = useCallback((next: boolean): void => {
    atBottomRef.current = next;
    setAtBottom(next);
  }, []);

  const onScroll = useCallback(
    (el: HTMLDivElement): void =>
      setPosition(distanceFromBottom(el) <= SCROLL_BOTTOM_THRESHOLD),
    [setPosition],
  );

  const scrollToBottom = useCallback((): void => {
    const el = ref.current;
    if (el) {
      el.scrollTop = 0;
      setPosition(true);
    }
  }, [setPosition]);

  // Expanding a block reveals content the pin would push straight back out of view, so stop
  // following the bottom before it grows: the observer below then holds the reader's place
  // through the expansion and through whatever the turn keeps streaming. The observer settles
  // the flag against the real offset afterwards, so a thread too short to scroll stays "at
  // bottom" and doesn't sprout a scroll-to-bottom button.
  const pauseAutoScroll = useCallback((): void => {
    atBottomRef.current = false;
  }, []);

  // Keep a scrolled-up reader's place: any change to the content height moves the thread under
  // them (the offset is measured from the bottom), so absorb the difference into the offset.
  // At the bottom there is nothing to hold — the browser's anchoring already handles it.
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    let lastHeight = el.scrollHeight;

    // Mirror the vertical scrollbar's footprint onto the opposite edge, so the centred column
    // stays centred instead of sliding left when the thread becomes scrollable. `scrollbar-gutter:
    // stable both-edges` is meant to do this, but the desktop app's WebKit doesn't reserve it —
    // measuring the scrollbar works in every engine (padding doesn't feed back into the reading).
    const syncGutter = (): void =>
      el.style.setProperty(
        '--thread-scrollbar',
        `${el.offsetWidth - el.clientWidth}px`,
      );

    const absorb = (): void => {
      const height = el.scrollHeight;
      const delta = height - lastHeight;
      lastHeight = height;
      if (delta !== 0 && !atBottomRef.current) {
        el.scrollTop -= delta;
      }
      // Settle the flag against where the offset actually ended up: the write above can be
      // clamped (nothing left to hold on to), and a release that grew the thread by less than
      // the threshold still counts as being at the bottom.
      setPosition(distanceFromBottom(el) <= SCROLL_BOTTOM_THRESHOLD);
      // Growing past (or shrinking below) the viewport toggles the scrollbar.
      syncGutter();
    };

    syncGutter();

    // Rows resize as they stream, render their markdown or expand a block; they also come and go.
    const rowResize = new ResizeObserver(absorb);
    Array.from(el.children).forEach((row) => rowResize.observe(row));

    const rowList = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            rowResize.observe(node);
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (node instanceof Element) {
            rowResize.unobserve(node);
          }
        });
      });
      absorb();
    });
    rowList.observe(el, { childList: true });

    // A resized panel changes the scrollbar's footprint (and whether there is one at all).
    const scrollerResize = new ResizeObserver(syncGutter);
    scrollerResize.observe(el);

    return (): void => {
      rowResize.disconnect();
      rowList.disconnect();
      scrollerResize.disconnect();
    };
  }, [setPosition]);

  return { ref, atBottom, onScroll, scrollToBottom, pauseAutoScroll };
};
