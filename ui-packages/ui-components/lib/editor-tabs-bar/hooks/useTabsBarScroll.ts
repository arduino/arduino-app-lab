import { useCallback, useEffect, useState } from 'react';

type UseTabsBarScroll = (params: {
  scrollRef: React.RefObject<HTMLUListElement>;
  selectedFileId: string | undefined;
}) => {
  isScrollable: boolean;
};

export const useTabsBarScroll: UseTabsBarScroll = ({
  scrollRef,
  selectedFileId,
}) => {
  const [isScrollable, setIsScrollable] = useState(false);

  // Add horizontal scroll support for mouse wheel
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollRef]);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      setIsScrollable(hasOverflow);
    }
  }, [scrollRef]);

  // Check if tabs are overflowing and scroll is in action
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const callback = (): number => window.requestAnimationFrame(checkOverflow);

    const resizeObserver = new ResizeObserver(callback);
    const mutationObserver = new MutationObserver(callback);

    resizeObserver.observe(el);
    mutationObserver.observe(el, { childList: true });

    callback();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [checkOverflow, scrollRef]);

  // Auto-scroll to selected tab when selectedFileId changes
  useEffect(() => {
    if (!selectedFileId || !scrollRef.current) return;
    const escapedFileId = CSS.escape(selectedFileId);
    const selector = `[data-file-id="${escapedFileId}"]`;

    const scrollIfFound = (container: HTMLElement): boolean => {
      const target = container.querySelector(selector) as HTMLElement;
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
        return true;
      }
      return false;
    };

    const foundImmediately = scrollIfFound(scrollRef.current);
    if (foundImmediately) return;

    const observer = new MutationObserver((_, obs) => {
      if (scrollRef.current && scrollIfFound(scrollRef.current)) {
        obs.disconnect();
      }
    });

    observer.observe(scrollRef.current, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [scrollRef, selectedFileId]);

  return { isScrollable };
};
