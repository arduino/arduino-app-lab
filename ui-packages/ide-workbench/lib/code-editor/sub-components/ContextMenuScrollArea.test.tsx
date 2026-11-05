import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextMenuScrollArea } from './ContextMenuScrollArea';

// jsdom has no layout, so the viewport's metrics are stood up by hand
const stubViewportMetrics = (
  clientHeight: number,
  scrollHeight: number,
): void => {
  vi.spyOn(HTMLDivElement.prototype, 'clientHeight', 'get').mockReturnValue(
    clientHeight,
  );
  vi.spyOn(HTMLDivElement.prototype, 'scrollHeight', 'get').mockReturnValue(
    scrollHeight,
  );
};

const renderScrollArea = (): HTMLElement => {
  render(
    <ContextMenuScrollArea>
      <div>Copy</div>
    </ContextMenuScrollArea>,
  );
  return screen.getByText('Copy').parentElement?.parentElement as HTMLElement;
};

// Frames are run one at a time, else the loop recurses until the stack blows
let pendingFrame: FrameRequestCallback | undefined;

const runFrame = (): void => {
  const frame = pendingFrame;
  pendingFrame = undefined;
  act(() => frame?.(0));
};

describe('ContextMenuScrollArea', () => {
  beforeEach(() => {
    pendingFrame = undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = (): void => undefined;
        disconnect = (): void => undefined;
      },
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        pendingFrame = cb;
        return 1;
      },
    );
    vi.stubGlobal('cancelAnimationFrame', (): void => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders no chevron when the content fits', () => {
    stubViewportMetrics(200, 200);
    renderScrollArea();

    expect(document.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders the down chevron and scrolls on hover when the content overflows', () => {
    stubViewportMetrics(100, 400);
    const viewport = renderScrollArea();

    const [chevron] = document.querySelectorAll('button');
    expect(chevron).toBeDefined();

    fireEvent.pointerEnter(chevron);
    runFrame();

    expect(viewport.scrollTop).toBeGreaterThan(0);
  });

  it('renders the up chevron once the viewport is scrolled away from the top', () => {
    stubViewportMetrics(100, 400);
    const viewport = renderScrollArea();
    viewport.scrollTop = 50;

    fireEvent.scroll(viewport);

    expect(document.querySelectorAll('button')).toHaveLength(2);
  });
});
