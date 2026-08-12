import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileOpenProvider } from './FileOpenContext';
import { Link } from './Link';

const openFile = vi.fn<[string], void>();

// Links live in the chat thread, which provides the file-open handler.
const renderInChat = (ui: ReactNode): void => {
  render(<FileOpenProvider value={openFile}>{ui}</FileOpenProvider>);
};

describe('Link', () => {
  beforeEach(() => {
    openFile.mockReset();
    delete (window as { runtime?: unknown }).runtime;
  });

  it('opens an external link in the system browser instead of the webview', () => {
    const BrowserOpenURL = vi.fn();
    (window as { runtime?: unknown }).runtime = { BrowserOpenURL };

    render(<Link href="https://docs.arduino.cc">docs</Link>);
    const link = screen.getByRole('link', { name: /docs/ });
    expect(link).toHaveAttribute('href', 'https://docs.arduino.cc');

    // The click must not be left to the webview, which would navigate in place.
    const followed = link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(BrowserOpenURL).toHaveBeenCalledWith('https://docs.arduino.cc');
    expect(followed).toBe(false);
  });

  it('opens a file path in the editor, with no href to follow', () => {
    renderInChat(<Link href="my-app/main.py">main.py</Link>);

    const link = screen.getByRole('link', { name: 'main.py' });
    expect(link).not.toHaveAttribute('href');
    link.click();
    expect(openFile).toHaveBeenCalledWith('my-app/main.py');
  });

  it('opens a file from the keyboard, like a real link', () => {
    renderInChat(<Link href="my-app/main.py">main.py</Link>);

    const link = screen.getByRole('link', { name: 'main.py' });
    expect(link).toHaveAttribute('tabindex', '0'); // a span is only reachable if we say so
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(openFile).toHaveBeenCalledWith('my-app/main.py');
  });

  it('opens the file without triggering the control it sits in', () => {
    const onToggle = vi.fn();
    renderInChat(
      <button type="button" onClick={onToggle}>
        Write <Link href="my-app/main.py">my-app/main.py</Link>
      </button>,
    );

    screen.getByRole('link', { name: 'my-app/main.py' }).click();
    expect(openFile).toHaveBeenCalledWith('my-app/main.py');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('renders a file as plain text where nothing can open it', () => {
    // No provider: a link affordance would promise something the click can't deliver.
    render(<Link href="my-app/main.py">main.py</Link>);

    expect(screen.getByText('main.py')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a non-followable scheme as plain text', () => {
    renderInChat(<Link href="data:text/html,<b>x</b>">the image</Link>);

    expect(screen.getByText('the image')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
