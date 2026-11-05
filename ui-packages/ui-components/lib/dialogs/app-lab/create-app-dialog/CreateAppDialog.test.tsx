import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

import { CreateAppDialog } from './CreateAppDialog';

const renderDialog = (): ReturnType<typeof vi.fn> => {
  const confirmAction = vi.fn().mockResolvedValue(true);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntlProvider locale="en">
        <CreateAppDialog
          logic={(): ReturnType<
            Parameters<typeof CreateAppDialog>[0]['logic']
          > => ({
            open: true,
            confirmAction,
            onOpenChange: vi.fn(),
            sendNotification: vi.fn(),
          })}
        />
      </IntlProvider>
    </QueryClientProvider>,
  );
  return confirmAction;
};

const submit = async (): Promise<void> => {
  await act(async () => {
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
  });
};

describe('CreateAppDialog', () => {
  it('rejects a name made only of spaces', async () => {
    const confirmAction = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Create new' })
        .disabled,
    ).toBe(true);
    await submit();
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it('sends the trimmed name', async () => {
    const confirmAction = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  My App  ' },
    });

    await submit();
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My App' }),
    );
  });
});
