import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

// Browser APIs jsdom lacks: the app-lab barrel imports from also pull in the
// serial monitor, which constructs a web worker at import time.
vi.hoisted(() => {
  const noop = (): void => undefined;

  globalThis.Worker = class {
    addEventListener = noop;
    postMessage = noop;
    terminate = noop;
  } as unknown as typeof Worker;

  globalThis.ResizeObserver = class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  } as unknown as typeof ResizeObserver;
});

import { UseTerminalSettingsLogic } from '../settings.type';
import { TerminalSelector } from './TerminalSelector';

const terminals = [
  {
    id: 'alacritty',
    label: 'Alacritty',
    path: '/usr/bin/alacritty',
    available: true,
  },
  {
    id: 'ghostty',
    label: 'Ghostty',
    path: '/usr/bin/ghostty',
    available: true,
  },
];

const renderSelector = (
  overrides: Partial<ReturnType<UseTerminalSettingsLogic>> = {},
): { setPreference: ReturnType<typeof vi.fn> } => {
  const setPreference = vi.fn().mockResolvedValue(undefined);

  const logic: UseTerminalSettingsLogic = () => ({
    supported: true,
    terminals,
    preference: '',
    setPreference,
    ...overrides,
  });

  render(
    <IntlProvider locale="en">
      <TerminalSelector logic={logic} />
    </IntlProvider>,
  );

  return { setPreference };
};

const openMenu = (): void => {
  fireEvent.click(screen.getByRole('button'));
};

describe('TerminalSelector', () => {
  it('does not offer the terminals that are not installed', () => {
    renderSelector({
      terminals: [
        ...terminals,
        { id: 'kitty', label: 'Kitty', path: '', available: false },
      ],
    });

    openMenu();

    expect(screen.getByText('Alacritty')).toBeInTheDocument();
    expect(screen.queryByText('Kitty')).not.toBeInTheDocument();
  });

  it('tells that the selected terminal is not installed', () => {
    renderSelector({
      terminals: [
        ...terminals,
        { id: 'kitty', label: 'Kitty', path: '', available: false },
      ],
      preference: 'kitty',
    });

    expect(screen.getByRole('button')).toHaveTextContent(
      'Kitty (not installed)',
    );
  });

  it('shows the automatic detection when no terminal is selected', () => {
    renderSelector();

    expect(screen.getByRole('button')).toHaveTextContent('Automatic');
  });

  it('lists the detected terminal emulators', async () => {
    renderSelector();

    openMenu();

    expect(await screen.findByText('Alacritty')).toBeInTheDocument();
    expect(screen.getByText('Ghostty')).toBeInTheDocument();
    expect(screen.getByText('Custom…')).toBeInTheDocument();
  });

  it('saves the terminal selected by the user', async () => {
    const { setPreference } = renderSelector();

    openMenu();
    fireEvent.click(await screen.findByText('Ghostty'));

    await waitFor(() => expect(setPreference).toHaveBeenCalledWith('ghostty'));
  });

  it('saves the automatic detection when it is selected again', async () => {
    const { setPreference } = renderSelector({ preference: 'ghostty' });

    openMenu();
    fireEvent.click(await screen.findByText('Automatic'));

    await waitFor(() => expect(setPreference).toHaveBeenCalledWith(''));
  });

  it('shows the custom command when it is selected', () => {
    renderSelector({ preference: 'my-terminal' });

    expect(screen.getByRole('button')).toHaveTextContent(
      'Custom (my-terminal)',
    );
  });

  it('saves the custom command', async () => {
    const { setPreference } = renderSelector();

    openMenu();
    fireEvent.click(await screen.findByText('Custom…'));

    const input = await screen.findByPlaceholderText('e.g. alacritty');
    fireEvent.change(input, { target: { value: 'my-terminal' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(setPreference).toHaveBeenCalledWith('my-terminal'),
    );
  });

  it('does not save an empty custom command', async () => {
    const { setPreference } = renderSelector();

    openMenu();
    fireEvent.click(await screen.findByText('Custom…'));

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('warns that the custom command is executed', async () => {
    renderSelector();

    openMenu();
    fireEvent.click(await screen.findByText('Custom…'));

    expect(
      await screen.findByText(
        'The command is executed with the permissions of the user running App Lab.',
      ),
    ).toBeInTheDocument();
  });

  it('clears the error when the command is edited', async () => {
    const setPreference = vi.fn().mockRejectedValue(new Error('not found'));
    const logic: UseTerminalSettingsLogic = () => ({
      supported: true,
      terminals: [],
      preference: '',
      setPreference,
    });

    render(
      <IntlProvider locale="en">
        <TerminalSelector logic={logic} />
      </IntlProvider>,
    );

    openMenu();
    fireEvent.click(await screen.findByText('Custom…'));

    const input = await screen.findByPlaceholderText('e.g. alacritty');
    fireEvent.change(input, { target: { value: 'my-terminal' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('not found')).toBeInTheDocument();

    // The error belongs to the value that was rejected, editing the value
    // clears it.
    fireEvent.change(input, { target: { value: 'my-other-terminal' } });

    await waitFor(() =>
      expect(screen.queryByText('not found')).not.toBeInTheDocument(),
    );
  });
});
