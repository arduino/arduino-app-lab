import { FlashEvent, OSImageRelease } from '@cloud-editor-mono/infrastructure';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

// Browser APIs jsdom lacks: the app-lab barrel the flasher imports from also
// pulls in the serial monitor, which constructs a web worker at import time.
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

import { Flasher } from './Flasher';
import { FlasherLogic } from './flasher.type';

const latest: OSImageRelease = {
  id: '2',
  version_label: '20250301-3',
  latest: true,
};
const ENOUGH_SPACE = 11 * 1024 * 1024 * 1024;

interface FlashControl {
  emit: (event: FlashEvent) => void;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

const renderFlasher = (): {
  close: ReturnType<typeof vi.fn>;
  flash: () => FlashControl;
} => {
  const close = vi.fn();
  let control: FlashControl | undefined;

  const flashBoard: ReturnType<FlasherLogic>['flashBoard'] = (
    _image,
    _preserve,
    onFlashEvent,
  ) =>
    new Promise<void>((resolve, reject) => {
      control = { emit: onFlashEvent, resolve, reject };
    });

  // Created once: FlasherConfiguration reloads the image list whenever one of
  // these functions changes identity.
  const stable: Omit<ReturnType<FlasherLogic>, 'succeeded' | 'setSucceeded'> = {
    loading: false,
    setFlashing: vi.fn(),
    close,
    getCurrentImage: vi.fn().mockResolvedValue(latest),
    listAvailableImages: vi.fn().mockResolvedValue([latest]),
    getAvailableFreeSpace: vi.fn().mockResolvedValue(ENOUGH_SPACE),
    getUserPartitionPreservationSupported: vi.fn().mockResolvedValue(true),
    flashBoard,
    openArduinoSupport: vi.fn(),
    clearBoardAsUsed: vi.fn().mockResolvedValue(undefined),
    flashingBoard: {
      id: 'board',
      name: 'board',
      type: 'Arduino UNO Q',
      connectionType: 'USB',
      protocol: 'serial',
      serial: '1234',
      address: '',
    },
    preserveDataSupported: true,
    preparationImage: null,
  };

  const useFlasherLogic: FlasherLogic = () => {
    const [succeeded, setSucceeded] = useState<boolean | null>(null);
    return { ...stable, succeeded, setSucceeded };
  };

  render(
    <IntlProvider locale="en">
      <Flasher flasherLogic={useFlasherLogic} />
    </IntlProvider>,
  );

  return {
    close,
    flash: (): FlashControl => {
      if (!control) {
        throw new Error('flash not started');
      }
      return control;
    },
  };
};

// Queried by text for the reason given in FlasherConfiguration.test.tsx.
const button = (label: string): HTMLButtonElement => {
  const found = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.trim().startsWith(label),
  );
  if (!found) {
    throw new Error(`${label} button not rendered`);
  }
  return found;
};

const startFlashing = async (): Promise<void> => {
  await waitFor(() => expect(button('Start flashing').disabled).toBe(false));
  fireEvent.click(button('Start flashing'));
};

const flashingProgress: FlashEvent = {
  step: 'flashing',
  log: 'writing',
  progress: 10,
  total: 100,
};

describe('Flasher', () => {
  it('disables Exit while the board is flashing', async () => {
    const { flash } = renderFlasher();
    await startFlashing();

    act(() => flash().emit(flashingProgress));

    expect(button('Exit').disabled).toBe(true);
  });

  it('enables Exit after a failed flash, and Exit closes the flasher', async () => {
    const { close, flash } = renderFlasher();
    await startFlashing();
    act(() => flash().emit(flashingProgress));

    await act(async () => flash().reject('flash failed'));

    expect(button('Retry')).toBeTruthy();
    expect(button('Exit').disabled).toBe(false);
    fireEvent.click(button('Exit'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps Exit disabled after a successful flash, and OK, done closes the flasher', async () => {
    const { close, flash } = renderFlasher();
    await startFlashing();
    act(() => flash().emit(flashingProgress));

    act(() =>
      flash().emit({ ...flashingProgress, log: 'completed', progress: 100 }),
    );
    await act(async () => flash().resolve());

    expect(button('Exit').disabled).toBe(true);
    fireEvent.click(button('OK, done'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
