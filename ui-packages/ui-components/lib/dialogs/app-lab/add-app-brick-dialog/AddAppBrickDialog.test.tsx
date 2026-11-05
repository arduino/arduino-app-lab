import {
  AppBrickListItem,
  BrickListItem,
} from '@cloud-editor-mono/infrastructure';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../../components-by-app/app-lab', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  BricksList: ({
    bricks,
    onClick,
  }: {
    bricks: BrickListItem[];
    onClick: (brick: BrickListItem) => void;
  }): JSX.Element => (
    <>
      {bricks.map((brick) => (
        <button
          key={brick.id}
          type="button"
          onClick={(): void => onClick(brick)}
        >
          {brick.name}
        </button>
      ))}
    </>
  ),
  BrickDetail: ({ brickId }: { brickId: string }): JSX.Element => (
    <div data-testid="brick-detail">{brickId}</div>
  ),
}));

import { AddAppBrickDialog, AddAppBrickDialogLogic } from './AddAppBrickDialog';

const bricks: BrickListItem[] = [
  { id: 'arduino:air_quality', name: 'Air quality monitoring' },
  { id: 'arduino:camera', name: 'Camera' },
  { id: 'arduino:weather', name: 'Weather' },
];

type LogicState = ReturnType<AddAppBrickDialogLogic>;

const baseLogic: LogicState = {
  open: true,
  appId: 'app',
  bricks,
  appBricks: [],
  loadBrickDetails: vi.fn(),
  brickDetailLogic: vi.fn(),
  configureDialogLogic: vi.fn(),
  confirmAddAppBrick: vi.fn(),
  onOpenChange: vi.fn(),
  createAppBrickDialogLogic: vi.fn(),
  openCreateAppBrickDialog: vi.fn(),
  createAppBrickDialogOpen: false,
  onOpenExternal: vi.fn(),
};

const renderDialog = (
  overrides: Partial<LogicState> = {},
): { rerender: (next: Partial<LogicState>) => void } => {
  const ui = (state: Partial<LogicState>): JSX.Element => (
    <IntlProvider locale="en">
      <AddAppBrickDialog
        logic={(): LogicState => ({ ...baseLogic, ...state })}
      />
    </IntlProvider>
  );
  const { rerender } = render(ui(overrides));
  return { rerender: (next): void => rerender(ui({ ...overrides, ...next })) };
};

const selectedBrickId = (): string | null =>
  screen.getByTestId('brick-detail').textContent;

describe('AddAppBrickDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the added brick selected when appBricks refetches during the add', async () => {
    let resolveAdd: (success: boolean) => void = () => undefined;
    const confirmAddAppBrick = vi.fn(
      () => new Promise<boolean>((resolve) => (resolveAdd = resolve)),
    );
    const { rerender } = renderDialog({ confirmAddAppBrick });

    fireEvent.click(screen.getByText('Camera'));
    fireEvent.click(screen.getByText('Add'));
    rerender({ appBricks: [{ id: 'arduino:camera' } as AppBrickListItem] });

    expect(selectedBrickId()).toBe('arduino:camera');
    await act(async () => resolveAdd(false));
  });

  it('stops loading when the add rejects', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('add failed');
    let rejectAdd: (error: Error) => void = () => undefined;
    const confirmAddAppBrick = vi.fn(
      () => new Promise<boolean>((_, reject) => (rejectAdd = reject)),
    );
    const { rerender } = renderDialog({ confirmAddAppBrick });

    fireEvent.click(screen.getByText('Camera'));
    fireEvent.click(screen.getByText('Add'));
    await act(async () => rejectAdd(error));
    rerender({ appBricks: [{ id: 'arduino:camera' } as AppBrickListItem] });

    // Loading has stopped, so the selection moves off the brick now in the app.
    expect(selectedBrickId()).toBe('arduino:air_quality');
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('shows the success view when the details load rejects after the add', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('details failed');
    const loadBrickDetails = vi.fn(() => Promise.reject(error));
    renderDialog({
      confirmAddAppBrick: vi.fn(() => Promise.resolve(true)),
      loadBrickDetails,
    });

    fireEvent.click(screen.getByText('Camera'));
    await act(async () => fireEvent.click(screen.getByText('Add')));

    expect(loadBrickDetails).toHaveBeenCalledWith('arduino:camera');
    expect(screen.getByRole('heading', { name: 'Success' })).toBeTruthy();
    expect(screen.queryByTestId('brick-detail')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('selects the first brick not in the app when appBricks load after opening', () => {
    const { rerender } = renderDialog();
    expect(selectedBrickId()).toBe('arduino:air_quality');

    rerender({
      appBricks: [{ id: 'arduino:air_quality' } as AppBrickListItem],
    });

    expect(selectedBrickId()).toBe('arduino:camera');
  });

  it('resets the selection when the dialog reopens', () => {
    const { rerender } = renderDialog();
    fireEvent.click(screen.getByText('Weather'));

    rerender({ open: false });
    rerender({ open: true });

    expect(selectedBrickId()).toBe('arduino:air_quality');
  });
});
