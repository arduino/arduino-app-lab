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

import { ChangePasswordDialog } from './ChangePasswordDialog';

const renderDialog = (): { setUserPassword: ReturnType<typeof vi.fn> } => {
  const setUserPassword = vi.fn();
  render(
    <IntlProvider locale="en">
      <ChangePasswordDialog
        logic={(): ReturnType<
          Parameters<typeof ChangePasswordDialog>[0]['logic']
        > => ({
          open: true,
          onOpenChange: vi.fn(),
          setUserPassword,
          isLoading: false,
          confirmationIsError: false,
          isError: false,
          isSuccess: false,
          errorMsg: '',
          confirmationErrorMsg: '',
        })}
      />
    </IntlProvider>,
  );
  return { setUserPassword };
};

const passwordField = (id: string): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>(`input#${id}`);
  if (!input) {
    throw new Error(`${id} field not rendered`);
  }
  return input;
};

describe('ChangePasswordDialog', () => {
  it('saves on Enter once both fields are filled', async () => {
    const { setUserPassword } = renderDialog();

    await userEvent.type(passwordField('password'), 'secret');
    await userEvent.type(passwordField('confirm-password'), 'secret{Enter}');

    expect(setUserPassword).toHaveBeenCalledTimes(1);
    expect(setUserPassword).toHaveBeenCalledWith('secret', 'secret');
  });

  it('does nothing on Enter while a field is empty', async () => {
    const { setUserPassword } = renderDialog();

    await userEvent.type(passwordField('password'), 'secret{Enter}');

    expect(setUserPassword).not.toHaveBeenCalled();
  });
});
