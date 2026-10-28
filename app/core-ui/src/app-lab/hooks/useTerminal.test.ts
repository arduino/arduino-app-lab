/**
 * The terminal button reports the failures with a snackbar: the terminal may
 * not be found on the system, or the terminal selected in the settings may not
 * be started and another one is used instead.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTerminal } from './useTerminal';

const h = vi.hoisted(() => ({
  openBoardTerminal: vi.fn(),
  snackbar: vi.fn(),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    openBoardTerminal: h.openBoardTerminal,
  }),
);

vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  () => ({
    snackbar: h.snackbar,
  }),
);

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not report anything when the terminal was opened', async () => {
    h.openBoardTerminal.mockResolvedValue({ terminal: 'alacritty' });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.onOpenTerminal();
    });

    expect(h.snackbar).not.toHaveBeenCalled();
  });

  it('warns when the selected terminal was not used', async () => {
    h.openBoardTerminal.mockResolvedValue({
      terminal: 'ghostty',
      warning:
        'the terminal selected in the settings could not be started: exit status 2',
    });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.onOpenTerminal();
    });

    expect(h.snackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'warning',
        message: expect.stringContaining('could not be started'),
      }),
    );
  });

  it('reports an error when no terminal could be opened', async () => {
    h.openBoardTerminal.mockRejectedValue(
      new Error(
        'no terminal emulator was found on this system: install one, or set a custom command in the settings',
      ),
    );

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.onOpenTerminal();
    });

    expect(h.snackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringContaining('no terminal emulator was found'),
      }),
    );
  });
});
