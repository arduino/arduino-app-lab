import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileOpenProvider } from '../Link/FileOpenContext';
import type { TimelineItem } from './Timeline';
import { TimelineRow } from './TimelineRow';

const openFile = vi.fn<[string], void>();

const item: TimelineItem = {
  id: 'tool-1',
  type: 'execute',
  title: 'Edited',
  file: { path: 'a1b2c3d4e5f6g7/main.py', label: 'main.py' },
  details: <pre>the diff</pre>,
};

const renderRow = (): void => {
  render(
    <FileOpenProvider value={openFile}>
      <ul>
        <TimelineRow item={item} />
      </ul>
    </FileOpenProvider>,
  );
};

describe('TimelineRow', () => {
  beforeEach(() => {
    openFile.mockReset();
  });

  // The row expands from anywhere while the file opens on click, so the two controls have to be
  // siblings: a disclosure <button> wrapping the link would hide it from assistive tech.
  it('exposes the file link and the disclosure as separate controls', () => {
    renderRow();

    expect(screen.getByRole('link', { name: 'main.py' })).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('reveals the details from the disclosure', () => {
    renderRow();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('the diff')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the file without expanding the row', () => {
    renderRow();

    screen.getByRole('link', { name: 'main.py' }).click();
    expect(openFile).toHaveBeenCalledWith('a1b2c3d4e5f6g7/main.py');
    expect(screen.queryByText('the diff')).not.toBeInTheDocument();
  });
});
