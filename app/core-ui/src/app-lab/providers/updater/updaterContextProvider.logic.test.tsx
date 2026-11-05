import { EventSourceHandlers } from '@cloud-editor-mono/infrastructure';
import { UpdaterStatus } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { updaterMessages } from './messages';
import { useUpdater } from './updaterContextProvider.logic';

vi.mock('../../store/boardLifecycle', async () => {
  const actual = await vi.importActual<
    typeof import('../../store/boardLifecycle')
  >('../../store/boardLifecycle');

  return {
    ...actual,
    useBoardLifecycleStore: vi.fn((selector) =>
      selector({
        boardIsReachable: true,
      }),
    ),
  };
});

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  async () => {
    const actual = await vi.importActual<
      typeof import('@cloud-editor-mono/domain/src/services/services-by-app/app-lab')
    >('@cloud-editor-mono/domain/src/services/services-by-app/app-lab');

    return {
      ...actual,
      applyBoardUpdate: vi.fn(),
      checkAndApplyUpdate: vi.fn(),
      checkBoardUpdate: vi.fn(),
      getBoardUpdateLogs: vi.fn(),
      getCurrentVersion: vi.fn(),
      getMandatoryUpdatesList: vi.fn(),
      getReleaseImageSrc: vi.fn(),
      getReleaseNotes: vi.fn(),
      getVersion: vi.fn(),
      isBoard: vi.fn(),
      isFFEnabled: vi.fn(),
      newVersion: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);

const createWrapper = (messages?: Record<string, string>) =>
  function UpdaterTestWrapper({ children }: PropsWithChildren): JSX.Element {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return (
      <QueryClientProvider client={client}>
        <IntlProvider locale="en" messages={messages}>
          {children}
        </IntlProvider>
      </QueryClientProvider>
    );
  };

/**
 * Starts a board update and hands back the stream handlers the updater
 * registered, so a test can push events at it the way the board would.
 */
const startUpdateAndCaptureStream = async (
  messages?: Record<string, string>,
): Promise<{
  result: { current: ReturnType<typeof useUpdater> };
  handlers: EventSourceHandlers;
  /** The handlers of the stream opened most recently: a retry opens a new one. */
  latestHandlers: () => EventSourceHandlers;
}> => {
  let handlers: EventSourceHandlers | undefined;
  domainServices.getBoardUpdateLogs.mockImplementation(async (h) => {
    handlers = h;
  });

  const { result } = renderHook(() => useUpdater(), {
    wrapper: createWrapper(messages),
  });

  await act(async () => {
    await result.current.checkForUpdates();
  });

  act(() => {
    result.current.startUpdate();
  });

  await waitFor(() => expect(handlers).toBeDefined());

  return {
    result,
    handlers: handlers as EventSourceHandlers,
    latestHandlers: () => handlers as EventSourceHandlers,
  };
};

beforeEach(() => {
  vi.clearAllMocks();

  domainServices.isBoard.mockResolvedValue(true);
  domainServices.isFFEnabled.mockReturnValue(false);
  domainServices.getCurrentVersion.mockResolvedValue('1.0.0');
  domainServices.getMandatoryUpdatesList.mockResolvedValue([]);
  // No App Lab update: the board update is the one that reports progress.
  domainServices.newVersion.mockResolvedValue('');
  domainServices.applyBoardUpdate.mockResolvedValue(true);
  domainServices.checkAndApplyUpdate.mockResolvedValue(undefined);
  domainServices.getReleaseNotes.mockResolvedValue('release notes');
  domainServices.getReleaseImageSrc.mockReturnValue('release-image.png');
  domainServices.checkBoardUpdate.mockResolvedValue({
    updates: [{ name: 'arduino-app-lab', to_version: '1.1.0' }],
  });
});

describe('useUpdater - board update progress', () => {
  it('starts without a percentage, then follows the progress events', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    expect(result.current.boardUpdateProgress).toBeUndefined();

    act(() => {
      handlers.onmessage?.({
        id: '',
        event: 'progress',
        data: '{"step":"docker images download","progress":44}',
      });
    });

    expect(result.current.boardUpdateProgress).toBe(44);

    act(() => {
      handlers.onmessage?.({
        id: '',
        event: 'progress',
        data: '{"step":"upgrade completed","progress":100}',
      });
    });

    expect(result.current.boardUpdateProgress).toBe(100);
  });

  it('drops the percentage of the previous run when a retry starts', async () => {
    const { result, handlers, latestHandlers } =
      await startUpdateAndCaptureStream();

    act(() => {
      handlers.onmessage?.({
        id: '',
        event: 'progress',
        data: '{"step":"docker images download","progress":44}',
      });
    });

    expect(result.current.boardUpdateProgress).toBe(44);

    // The run fails and the dialog offers the update again.
    act(() => {
      result.current.setStatus(UpdaterStatus.UpdateFailed);
    });

    act(() => {
      result.current.setStatus(UpdaterStatus.UpdateAvailable);
    });

    act(() => {
      result.current.startUpdate();
    });

    // The retry is indeterminate until its own first progress event: it must
    // not resume at the percentage the failed run died on.
    expect(result.current.boardUpdateProgress).toBeUndefined();

    act(() => {
      latestHandlers().onmessage?.({
        id: '',
        event: 'progress',
        data: '{"step":"update index","progress":5}',
      });
    });

    expect(result.current.boardUpdateProgress).toBe(5);
  });

  it('drops the board percentage when the App Lab update takes over', async () => {
    // Off the board, an App Lab update follows the board one.
    domainServices.isBoard.mockResolvedValue(false);
    domainServices.newVersion.mockResolvedValue('2.0.0');

    const { result, handlers } = await startUpdateAndCaptureStream();

    act(() => {
      handlers.onmessage?.({
        id: '',
        event: 'progress',
        data: '{"step":"docker images download","progress":44}',
      });
    });

    expect(result.current.boardUpdateProgress).toBe(44);

    await act(async () => {
      handlers.onmessage?.({
        id: '',
        event: 'done',
        data: '"upgrade completed"',
      });
    });

    // The App Lab phase reports no progress of its own, so the bar goes back to
    // indeterminate rather than sitting on the board update's last percentage.
    expect(result.current.boardLogs).toContain('Starting App Lab update...');
    expect(result.current.appUpdateSucceeded).toBe(true);
    expect(result.current.boardUpdateProgress).toBeUndefined();
  });

  it('rounds to an integer and clamps to 0-100', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    const progressValues = [43.6, 120, -5];
    const expected = [44, 100, 0];

    progressValues.forEach((progress, index) => {
      act(() => {
        handlers.onmessage?.({
          id: '',
          event: 'progress',
          data: `{"step":"apt upgrade","progress":${progress}}`,
        });
      });

      expect(result.current.boardUpdateProgress).toBe(expected[index]);
    });
  });

  it('keeps progress events out of the log panel', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    const logsBefore = result.current.boardLogs.length;

    act(() => {
      handlers.onmessage?.({
        id: '',
        event: 'progress',
        data: '{"step":"docker images download","progress":44}',
      });
    });

    expect(result.current.boardLogs).toHaveLength(logsBefore);
    expect(result.current.boardLogs.some((log) => log.includes('docker'))).toBe(
      false,
    );
  });

  it('still prints log events', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    act(() => {
      handlers.onmessage?.({
        id: '',
        event: 'log',
        data: '"updating package: arduino-app-lab"',
      });
    });

    expect(result.current.boardLogs).toContain(
      'updating package: arduino-app-lab',
    );
  });
});

describe('useUpdater - malformed progress payloads', () => {
  /** Drives the bar to 44%, so a payload that is ignored is visible as such. */
  const startAt44 = async (): Promise<{
    result: { current: ReturnType<typeof useUpdater> };
    push: (data: string) => void;
  }> => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    const push = (data: string): void => {
      act(() => {
        handlers.onmessage?.({ id: '', event: 'progress', data });
      });
    };

    push('{"step":"docker images download","progress":44}');
    expect(result.current.boardUpdateProgress).toBe(44);

    return { result, push };
  };

  it.each([
    ['a percentage sent as a string', '{"step":"apt upgrade","progress":"70"}'],
    ['a missing percentage', '{"step":"apt upgrade"}'],
    [
      'a percentage that is not numeric',
      '{"step":"apt upgrade","progress":"abc"}',
    ],
    ['a null payload', 'null'],
    ['a bare number', '42'],
    ['a bare string', '"apt upgrade"'],
    ['malformed JSON', '{"step":"apt upgrade","progress":'],
  ])('ignores %s and holds the last percentage', async (_case, data) => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { result, push } = await startAt44();

    push(data);

    expect(result.current.boardUpdateProgress).toBe(44);
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it('clamps a percentage too large to represent', async () => {
    const { result, push } = await startAt44();

    push('{"step":"apt upgrade","progress":1e999}');
    expect(result.current.boardUpdateProgress).toBe(100);

    push('{"step":"apt upgrade","progress":-1e999}');
    expect(result.current.boardUpdateProgress).toBe(0);
  });
});

describe('useUpdater - one App Lab update per board update flow', () => {
  const countLog = (logs: string[], line: string): number =>
    logs.filter((log) => log === line).length;

  const expectOneAppUpdate = (logs: string[]): void => {
    expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(1);
    expect(countLog(logs, 'Board update completed successfully.')).toBe(1);
    expect(countLog(logs, 'Starting App Lab update...')).toBe(1);
  };

  const push = (
    handlers: EventSourceHandlers,
    event: 'done' | 'restarting',
  ): void => {
    handlers.onmessage?.({ id: '', event, data: `"${event}"` });
  };

  beforeEach(() => {
    // Off the board, an App Lab update follows the board one.
    domainServices.isBoard.mockResolvedValue(false);
    domainServices.newVersion.mockResolvedValue('2.0.0');
    domainServices.getVersion.mockResolvedValue('1.0.0');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs once when `restarting` reaches the board before `done` arrives', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();
    vi.useFakeTimers();

    act(() => push(handlers, 'restarting'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await act(async () => push(handlers, 'done'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expectOneAppUpdate(result.current.boardLogs);
  });

  it('runs once when `done` arrives before the `restarting` loop', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();
    vi.useFakeTimers();

    await act(async () => push(handlers, 'done'));
    act(() => push(handlers, 'restarting'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expectOneAppUpdate(result.current.boardLogs);
    // The loop must not overwrite the App Lab update's status.
    expect(result.current.status).toBe(UpdaterStatus.Restarting);
  });

  it('runs once when `restarting` starts its loop and `done` arrives during the wait', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();
    vi.useFakeTimers();

    act(() => push(handlers, 'restarting'));
    await act(async () => push(handlers, 'done'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expectOneAppUpdate(result.current.boardLogs);
    expect(countLog(result.current.boardLogs, 'Connection established')).toBe(
      0,
    );
  });

  it('runs once when `done` arrives while `getVersion` is still waiting for the board', async () => {
    let answer: (version: string) => void = () => undefined;
    domainServices.getVersion.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          answer = resolve;
        }),
    );
    const { result, handlers } = await startUpdateAndCaptureStream();
    vi.useFakeTimers();

    act(() => push(handlers, 'restarting'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(domainServices.getVersion).toHaveBeenCalledTimes(1);
    await act(async () => push(handlers, 'done'));
    await act(async () => answer('1.0.0'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expectOneAppUpdate(result.current.boardLogs);
    expect(countLog(result.current.boardLogs, 'Connection established')).toBe(
      0,
    );
  });

  it('does not let the reconnect loop of a failed flow start the App Lab update of its retry', async () => {
    domainServices.checkAndApplyUpdate.mockRejectedValueOnce(
      new Error('network down'),
    );
    const { result, handlers, latestHandlers } =
      await startUpdateAndCaptureStream();
    vi.useFakeTimers();

    act(() => push(handlers, 'restarting'));
    await act(async () => push(handlers, 'done'));
    expect(result.current.status).toBe(UpdaterStatus.UpdateFailed);

    // Retry inside the 5 s wait of the first flow's reconnect loop.
    act(() => {
      result.current.startUpdate();
    });
    expect(latestHandlers()).not.toBe(handlers);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe(UpdaterStatus.UpdatingBoard);

    await act(async () => push(latestHandlers(), 'done'));

    expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(2);
  });

  it('runs once when the stream delivers `done` twice', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));
    await act(async () => push(handlers, 'done'));

    expectOneAppUpdate(result.current.boardLogs);
  });

  it('puts the reason of a failed App Lab update in the log', async () => {
    domainServices.checkAndApplyUpdate.mockRejectedValue(
      new Error(
        'error checking for updates: temp app already exists: /tmp/Arduino App Lab.app, cannot update',
      ),
    );
    const { result, handlers } = await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));

    expect(result.current.boardLogs).toContain(
      'App Lab update failed: error checking for updates: temp app already exists: /tmp/Arduino App Lab.app, cannot update',
    );
    expect(result.current.status).toBe(UpdaterStatus.UpdateFailed);
  });

  it('writes the failure in the active locale, with the backend reason as a value', async () => {
    domainServices.checkAndApplyUpdate.mockRejectedValue(
      new Error('network down'),
    );
    const { result, handlers } = await startUpdateAndCaptureStream({
      [updaterMessages.appUpdateFailedWithReason.id as string]:
        'Aggiornamento di App Lab non riuscito: {reason}',
    });

    await act(async () => push(handlers, 'done'));

    expect(result.current.boardLogs).toContain(
      'Aggiornamento di App Lab non riuscito: network down',
    );
  });

  it('says that an App Lab update is already running when the backend refuses a second one', async () => {
    // The text of `ErrUpdateInProgress` in internal/update/update.go.
    domainServices.checkAndApplyUpdate.mockRejectedValue(
      new Error('an App Lab update is already in progress'),
    );
    const { result, handlers } = await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));

    expect(result.current.boardLogs).toContain(
      updaterMessages.appUpdateAlreadyRunning.defaultMessage,
    );
    expect(
      result.current.boardLogs.some((log) =>
        log.startsWith('App Lab update failed'),
      ),
    ).toBe(false);
  });

  it('writes the failure without a reason when the backend gives none', async () => {
    domainServices.checkAndApplyUpdate.mockRejectedValue(new Error(''));
    const { result, handlers } = await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));

    expect(result.current.boardLogs).toContain('App Lab update failed');
    expect(result.current.status).toBe(UpdaterStatus.UpdateFailed);
  });

  it('runs the App Lab update again on a retry after a failure', async () => {
    domainServices.checkAndApplyUpdate.mockRejectedValueOnce(
      new Error('network down'),
    );
    const { result, handlers, latestHandlers } =
      await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));
    expect(result.current.status).toBe(UpdaterStatus.UpdateFailed);

    act(() => {
      result.current.setStatus(UpdaterStatus.UpdateAvailable);
    });
    act(() => {
      result.current.startUpdate();
    });
    await waitFor(() => expect(latestHandlers()).not.toBe(handlers));
    await act(async () => push(latestHandlers(), 'done'));

    expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe(UpdaterStatus.Restarting);
  });

  it('starts one App Lab update when there is no board update and the button is pressed twice', async () => {
    domainServices.checkBoardUpdate.mockResolvedValue({ updates: [] });
    let finish: () => void = () => undefined;
    domainServices.checkAndApplyUpdate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    const { result } = renderHook(() => useUpdater(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.checkForUpdates();
    });
    await waitFor(() => expect(result.current.newAppVersion).toBe('2.0.0'));

    act(() => {
      result.current.startUpdate();
      result.current.startUpdate();
    });
    await act(async () => finish());

    expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('useUpdater - a board update started elsewhere', () => {
  const completedLine = 'Board update completed successfully.';
  const countLog = (logs: string[], line: string): number =>
    logs.filter((log) => log === line).length;

  const push = (handlers: EventSourceHandlers, event: 'done'): void => {
    handlers.onmessage?.({ id: '', event, data: `"${event}"` });
  };

  /** The board reports that an update is already running, so the check joins its stream. */
  const joinRunningUpdate = async (result: {
    current: ReturnType<typeof useUpdater>;
  }): Promise<void> => {
    domainServices.checkBoardUpdate.mockRejectedValueOnce(
      new Error('OPERATION_IN_PROGRESS'),
    );
    await act(async () => {
      await result.current.checkForUpdates(true);
    });
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The first flow has completed and the status is back at its idle value. */
  const completeFirstFlow = async (
    result: { current: ReturnType<typeof useUpdater> },
    handlers: EventSourceHandlers,
  ): Promise<void> => {
    await act(async () => push(handlers, 'done'));
    expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
    act(() => result.current.setStatus(UpdaterStatus.None));
  };

  it('completes a second flow joined through the check after a first one completed', async () => {
    const { result, handlers, latestHandlers } =
      await startUpdateAndCaptureStream();

    await completeFirstFlow(result, handlers);

    await joinRunningUpdate(result);
    expect(result.current.status).toBe(UpdaterStatus.UpdatingBoard);
    expect(latestHandlers()).not.toBe(handlers);

    await act(async () => push(latestHandlers(), 'done'));

    expect(countLog(result.current.boardLogs, completedLine)).toBe(2);
    expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
  });

  it('reports a failure when the joined stream closes without `done`', async () => {
    const { result, handlers, latestHandlers } =
      await startUpdateAndCaptureStream();

    await completeFirstFlow(result, handlers);
    await joinRunningUpdate(result);

    vi.useFakeTimers();
    act(() => latestHandlers().onclose?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.status).toBe(UpdaterStatus.UpdateFailed);
  });

  it('completes once when a second stream of the running flow also sends `done`', async () => {
    // Off the board, an App Lab update follows the board one and keeps the flow running.
    domainServices.isBoard.mockResolvedValue(false);
    domainServices.newVersion.mockResolvedValue('2.0.0');
    domainServices.checkAndApplyUpdate.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    const { result, handlers, latestHandlers } =
      await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));
    expect(result.current.status).toBe(UpdaterStatus.UpdatingApp);

    await joinRunningUpdate(result);
    const second = latestHandlers();
    expect(second).not.toBe(handlers);
    await act(async () => push(second, 'done'));

    expect(countLog(result.current.boardLogs, completedLine)).toBe(1);
    expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(1);
  });

  describe('an in-progress answer while the completed result is showing', () => {
    it('keeps the result when the first stream closes after the answer', async () => {
      const { result, handlers } = await startUpdateAndCaptureStream();

      await act(async () => push(handlers, 'done'));
      await joinRunningUpdate(result);

      expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
      expect(domainServices.getBoardUpdateLogs).toHaveBeenCalledTimes(1);

      vi.useFakeTimers();
      act(() => handlers.onclose?.());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
      expect(countLog(result.current.boardLogs, completedLine)).toBe(1);
    });

    it('keeps the result when the answer arrives inside the close timer of the first stream', async () => {
      const { result, handlers } = await startUpdateAndCaptureStream();

      await act(async () => push(handlers, 'done'));

      vi.useFakeTimers();
      act(() => handlers.onclose?.());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await joinRunningUpdate(result);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
      expect(domainServices.getBoardUpdateLogs).toHaveBeenCalledTimes(1);
    });

    it('keeps the result when the answer arrives in the same task as `done`', async () => {
      const { result, handlers } = await startUpdateAndCaptureStream();
      domainServices.checkBoardUpdate.mockRejectedValueOnce(
        new Error('OPERATION_IN_PROGRESS'),
      );

      await act(async () => {
        push(handlers, 'done');
        await result.current.checkForUpdates(true);
      });

      expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
      expect(domainServices.getBoardUpdateLogs).toHaveBeenCalledTimes(1);
    });
  });

  describe('an in-progress answer after the reconnect loop gave up', () => {
    beforeEach(() => {
      // Off the board, an App Lab update follows the board one.
      domainServices.isBoard.mockResolvedValue(false);
      domainServices.newVersion.mockResolvedValue('2.0.0');
      domainServices.getVersion.mockRejectedValue(
        new Error('board unreachable'),
      );
    });

    const giveUpReconnecting = async (
      result: { current: ReturnType<typeof useUpdater> },
      handlers: EventSourceHandlers,
    ): Promise<void> => {
      vi.useFakeTimers();
      act(() => {
        handlers.onmessage?.({
          id: '',
          event: 'restarting',
          data: '"restarting"',
        });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000 + 10 * 1500);
      });
      expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
      expect(domainServices.checkAndApplyUpdate).not.toHaveBeenCalled();
    };

    it('joins the stream and starts the App Lab update on its `done`', async () => {
      const { result, handlers, latestHandlers } =
        await startUpdateAndCaptureStream();
      await giveUpReconnecting(result, handlers);

      await joinRunningUpdate(result);
      expect(latestHandlers()).not.toBe(handlers);
      await act(async () => push(latestHandlers(), 'done'));

      expect(domainServices.checkAndApplyUpdate).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe(UpdaterStatus.Restarting);
    });

    it('keeps the result when the joined stream closes without `done`', async () => {
      const { result, handlers, latestHandlers } =
        await startUpdateAndCaptureStream();
      await giveUpReconnecting(result, handlers);

      await joinRunningUpdate(result);
      act(() => latestHandlers().onclose?.());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
    });
  });
});

describe('useUpdater - a board update request that fails after `done`', () => {
  const push = (handlers: EventSourceHandlers, event: 'done'): void => {
    handlers.onmessage?.({ id: '', event, data: `"${event}"` });
  };

  let failRequest: (error: Error) => void = () => undefined;

  beforeEach(() => {
    domainServices.applyBoardUpdate.mockImplementation(
      () =>
        new Promise<boolean | null>((_, reject) => {
          failRequest = reject;
        }),
    );
  });

  it('keeps the completed result', async () => {
    const { result, handlers } = await startUpdateAndCaptureStream();

    await act(async () => push(handlers, 'done'));
    expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
    await act(async () => failRequest(new Error('connection reset')));

    expect(result.current.status).toBe(UpdaterStatus.UpdateComplete);
  });

  it('reports a failure when the request fails before `done`', async () => {
    const { result } = await startUpdateAndCaptureStream();

    await act(async () => failRequest(new Error('connection reset')));

    expect(result.current.status).toBe(UpdaterStatus.UpdateFailed);
  });
});
