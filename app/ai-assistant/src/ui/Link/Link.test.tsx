import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Markdown } from '../../features/chat/Message/Markdown';
import { FileOpenProvider } from './FileOpenContext';
import { Link } from './Link';

const openFile = vi.fn<(path: string) => void>();

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

  // Markdown's default sanitizer turns a file:// URL into javascript:void(0), which renders as plain text.
  it('opens a file:// link written in a reply', () => {
    renderInChat(
      <Markdown text="See [main.py](file:///abs/my-app/main.py)." />,
    );

    screen.getByRole('link', { name: 'main.py' }).click();
    expect(openFile).toHaveBeenCalledWith('/abs/my-app/main.py');
  });

  it('opens a file:// image written in a reply, and loads no image', () => {
    const { container } = render(
      <FileOpenProvider value={openFile}>
        <Markdown text="See ![main.py](file:///abs/my-app/main.py)." />
      </FileOpenProvider>,
    );

    screen.getByRole('link', { name: 'main.py' }).click();
    expect(openFile).toHaveBeenCalledWith('/abs/my-app/main.py');
    expect(container.querySelector('img')).toBeNull();
  });

  // An image's src reaches Link as written: the link sanitizer would make a drive path javascript:void(0).
  it.each([
    ['C:/app/main.py', 'C:/app/main.py'],
    ['C:\\app\\main.py', 'C:\\app\\main.py'],
  ])('opens a drive-path image written in a reply: %s', (src, path) => {
    renderInChat(<Markdown text={`See ![main.py](${src}).`} />);

    screen.getByRole('link', { name: 'main.py' }).click();
    expect(openFile).toHaveBeenCalledWith(path);
  });

  // The src as written can be URL-encoded or carry a line anchor; the tooltip names what a click opens.
  it.each([
    ['C:\\app\\main.py', 'C:\\app\\main.py'],
    ['file:///abs/my-app/main.py', '/abs/my-app/main.py'],
    ['python/main.py#L20', 'python/main.py'],
  ])('names the file a reply image opens: %s', (src, path) => {
    renderInChat(<Markdown text={`See ![main.py](${src}).`} />);

    expect(screen.getByRole('link', { name: 'main.py' })).toHaveAttribute(
      'title',
      path,
    );
  });

  it('names the file an image with no alt opens, in its text too', () => {
    renderInChat(<Markdown text="See ![](my%20app/main.py)." />);

    const link = screen.getByRole('link', { name: 'my app/main.py' });
    expect(link).toHaveAttribute('title', 'my app/main.py');
    link.click();
    expect(openFile).toHaveBeenCalledWith('my app/main.py');
  });

  it('opens the file a file:// link with a line hint names', () => {
    renderInChat(<Markdown text="See [main.py](file:///abs/main.py#L3)." />);

    screen.getByRole('link', { name: 'main.py' }).click();
    expect(openFile).toHaveBeenCalledWith('/abs/main.py');
  });

  it('keeps the address as the tooltip of a web image', () => {
    render(<Markdown text="See ![diagram](https://docs.arduino.cc/a.png)." />);

    expect(screen.getByRole('link', { name: /diagram/ })).toHaveAttribute(
      'title',
      'https://docs.arduino.cc/a.png',
    );
  });

  it('still renders a javascript: link in a reply as plain text', () => {
    renderInChat(<Markdown text="[run](javascript:alert(1))" />);

    expect(screen.getByText('run')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
