/**
 * Unit tests for useRuntimeLogic: the provider that drives run/stop actions and
 * feeds the app-lab console. Only the orchestrator SSE services are stubbed, so
 * the tests exercise the hook's own orchestration.
 *
 * The stubs capture the handlers each stream is opened with (`startAppHandlers` /
 * `stopAppHandlers`), which is what lets the tests replay an orchestrator failure
 * at the exact moment a real instant failure would arrive: while the handlers
 * handed to the stream are the ones created before the action updated state.
 */

import {
  AppDetailedInfo,
  EventSourceHandlers,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import {
  CONSOLE_SOURCE_KEYS,
  ConsoleSource,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { act, renderHook, RenderHookResult } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TestProviderWrapper from '../../../../tests-setup';
import { useRuntimeLogic } from './runtimeContextProvider.logic';

const h = vi.hoisted(() => ({
  startAppHandlers: [] as EventSourceHandlers[],
  stopAppHandlers: [] as EventSourceHandlers[],
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    startApp: vi.fn(async (_id: string, handlers: EventSourceHandlers) => {
      h.startAppHandlers.push(handlers);
    }),
    stopApp: vi.fn(async (_id: string, handlers: EventSourceHandlers) => {
      h.stopAppHandlers.push(handlers);
    }),
    getApps: vi.fn(async () => []),
    getAppStatus: vi.fn(async () => undefined),
    getAppLogs: vi.fn(async () => undefined),
    getSerialMonitorLogs: vi.fn(async () => undefined),
    findPorts: vi.fn(async () => []),
    forwardNonUIPort: vi.fn(async () => undefined),
    openUIWhenReady: vi.fn(async () => undefined),
    // Subscription, so it has to hand back an unsubscribe the effect can call on cleanup.
    onAgentStartedApp: vi.fn(() => () => undefined),
  }),
);

vi.mock('../../features/notifications', () => ({
  sendAppLabNotification: vi.fn(),
}));

const app = {
  id: 'app-1',
  name: 'My App',
  status: 'stopped',
} as AppDetailedInfo;

const FAILURE = 'another app is already running';

const emitFailure = async (handlers: EventSourceHandlers): Promise<void> => {
  await act(async () => {
    handlers.onmessage?.({
      id: '',
      event: StreamEventType.Error,
      data: JSON.stringify({ code: 'APP_ALREADY_RUNNING', message: FAILURE }),
    });
  });
};

const startupSourceOf = (
  result: RenderHookResult<
    ReturnType<typeof useRuntimeLogic>,
    unknown
  >['result'],
): ConsoleSource | undefined =>
  result.current.consoleLogic.consoleSources[app.id]?.[
    CONSOLE_SOURCE_KEYS.STARTUP
  ];

const renderRuntime = (): RenderHookResult<
  ReturnType<typeof useRuntimeLogic>,
  unknown
> => renderHook(() => useRuntimeLogic(), { wrapper: TestProviderWrapper });

describe('useRuntimeLogic', () => {
  beforeEach(() => {
    h.startAppHandlers.length = 0;
    h.stopAppHandlers.length = 0;
  });

  it('writes a run failure to the startup console on the first attempt', async () => {
    const { result } = renderRuntime();

    await act(async () => {
      await result.current.runtimeActions.runAction(app);
    });
    await emitFailure(h.startAppHandlers[0]);

    expect(startupSourceOf(result)?.subject.getValue().value).toContain(
      FAILURE,
    );
    expect(startupSourceOf(result)?.style).toBe('error');
  });

  it('keeps writing run failures to the startup console on later attempts', async () => {
    const { result } = renderRuntime();

    await act(async () => {
      await result.current.runtimeActions.runAction(app);
    });
    await emitFailure(h.startAppHandlers[0]);

    await act(async () => {
      await result.current.runtimeActions.runAction(app);
    });
    await emitFailure(h.startAppHandlers[1]);

    expect(startupSourceOf(result)?.subject.getValue().value).toContain(
      FAILURE,
    );
    expect(startupSourceOf(result)?.style).toBe('error');
  });

  it('writes a stop failure to the startup console on the first attempt', async () => {
    const { result } = renderRuntime();

    await act(async () => {
      await result.current.runtimeActions.stopAction({
        ...app,
        status: 'running',
      });
    });
    await emitFailure(h.stopAppHandlers[0]);

    expect(startupSourceOf(result)?.subject.getValue().value).toContain(
      FAILURE,
    );
    expect(startupSourceOf(result)?.style).toBe('error');
  });
});
