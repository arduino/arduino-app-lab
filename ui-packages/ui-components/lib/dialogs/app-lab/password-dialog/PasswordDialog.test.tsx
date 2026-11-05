import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { PasswordDialog } from './PasswordDialog';

const renderDialog = (): { onConfirm: ReturnType<typeof vi.fn> } => {
  const onConfirm = vi.fn();
  render(
    <IntlProvider locale="en">
      <PasswordDialog
        logic={(): ReturnType<
          Parameters<typeof PasswordDialog>[0]['logic']
        > => ({
          open: true,
          onOpenChange: vi.fn(),
          onConfirm,
          isLoading: false,
          isSuccess: false,
        })}
      />
    </IntlProvider>,
  );
  return { onConfirm };
};

const passwordField = (): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>('input#password');
  if (!input) {
    throw new Error('password field not rendered');
  }
  return input;
};

describe('PasswordDialog', () => {
  it('confirms on Enter', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(passwordField(), 'secret{Enter}');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('secret');
  });

  it('does nothing on Enter while the field is empty', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.type(passwordField(), '{Enter}');

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
