import { fireEvent, render, screen } from '@testing-library/react';
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

import {
  TrainNewModelDialog,
  TrainNewModelDialogLogic,
} from './TrainNewModelDialog';

const logic: TrainNewModelDialogLogic = () => ({
  isArduinoConnected: false,
  isEdgeImpulseConnected: false,
  isWelcomePageDismissed: false,
  dismissWelcomePage: vi.fn(),
  arduinoLogin: vi.fn(),
  edgeImpulseLogin: vi.fn(),
  openEdgeImpulse: vi.fn(),
});

const dialog = (open: boolean): JSX.Element => (
  <IntlProvider locale="en">
    <TrainNewModelDialog open={open} onOpenChange={vi.fn()} logic={logic} />
  </IntlProvider>
);

const welcomeTitle = 'Train your own custom AI Models';

describe('TrainNewModelDialog', () => {
  it('shows the welcome page again when it is reopened', () => {
    const { rerender } = render(dialog(true));
    expect(screen.getByText(welcomeTitle)).toBeTruthy();

    fireEvent.click(screen.getByText(`OK, let's start`));
    expect(screen.queryByText(welcomeTitle)).toBeNull();

    rerender(dialog(false));
    rerender(dialog(true));
    expect(screen.getByText(welcomeTitle)).toBeTruthy();
  });
});
