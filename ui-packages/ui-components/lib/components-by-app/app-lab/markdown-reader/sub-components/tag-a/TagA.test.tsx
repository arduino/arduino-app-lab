import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MarkdownReader from '../../MarkdownReader';

// jsdom does not implement scrollIntoView, so stand one up to observe.
const scrollIntoView = vi.fn();

beforeEach(() => {
  (
    Element.prototype as Element & { scrollIntoView: () => void }
  ).scrollIntoView = scrollIntoView;
});

afterEach(() => {
  scrollIntoView.mockReset();
});

describe('MarkdownReader link handling', () => {
  it('scrolls to a fragment in the same document', () => {
    const onOpenInternalLink = vi.fn();
    const { container } = render(
      <MarkdownReader
        content={'## Wiring\n\n[jump](#wiring)'}
        onOpenInternalLink={onOpenInternalLink}
      />,
    );

    fireEvent.click(container.querySelector('a[href="#wiring"]') as Element);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // A fragment is not a route, so the internal-link handler is not the right
    // place for it - and Learn's rejects bare fragments outright.
    expect(onOpenInternalLink).not.toHaveBeenCalled();
  });

  it('does not scroll for a fragment with no target', () => {
    const { container } = render(
      <MarkdownReader content={'[jump](#nowhere)'} />,
    );

    fireEvent.click(container.querySelector('a[href="#nowhere"]') as Element);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('still routes a path through the internal-link handler', () => {
    const onOpenInternalLink = vi.fn();
    const { container } = render(
      <MarkdownReader
        content={'[resource](/learn/getting-started)'}
        onOpenInternalLink={onOpenInternalLink}
      />,
    );

    fireEvent.click(
      container.querySelector('a[href="/learn/getting-started"]') as Element,
    );

    expect(onOpenInternalLink).toHaveBeenCalledWith('/learn/getting-started');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('still routes an absolute url through the external-link handler', () => {
    const onOpenExternalLink = vi.fn();
    const onOpenInternalLink = vi.fn();
    const { container } = render(
      <MarkdownReader
        content={'[docs](https://docs.arduino.cc)'}
        onOpenExternalLink={onOpenExternalLink}
        onOpenInternalLink={onOpenInternalLink}
      />,
    );

    fireEvent.click(
      container.querySelector('a[href="https://docs.arduino.cc"]') as Element,
    );

    expect(onOpenExternalLink).toHaveBeenCalledWith('https://docs.arduino.cc');
    expect(onOpenInternalLink).not.toHaveBeenCalled();
  });
});
