import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

// Browser APIs jsdom lacks: the app-lab barrel this dialog imports from also
// pulls in the serial monitor, which constructs a web worker at import time,
// and the modal's scrollable body observes its parent.
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

import { CustomBrickDialog } from './CustomBrickDialog';

const renderDialog = (): ReturnType<typeof vi.fn> => {
  const confirmAction = vi.fn().mockResolvedValue(true);
  render(
    <IntlProvider locale="en">
      <CustomBrickDialog
        logic={(): ReturnType<
          Parameters<typeof CustomBrickDialog>[0]['logic']
        > => ({
          open: true,
          confirmAction,
          onOpenChange: vi.fn(),
        })}
      />
    </IntlProvider>,
  );
  return confirmAction;
};

const pressEnter = async (): Promise<void> => {
  await act(async () => {
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  });
};

describe('CustomBrickDialog', () => {
  it('rejects a name made only of spaces', async () => {
    const confirmAction = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    await pressEnter();
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it('sends the trimmed name', async () => {
    const confirmAction = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  my brick  ' },
    });

    await pressEnter();
    expect(confirmAction).toHaveBeenCalledWith('my brick', undefined);
  });
});
