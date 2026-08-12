import {
  EventSourceHandlers,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiModelsLogic } from './aiModelsContextProvider.logic';

vi.mock('../../store/boardLifecycle', async () => {
  const actual = await vi.importActual<
    typeof import('../../store/boardLifecycle')
  >('../../store/boardLifecycle');

  return {
    ...actual,
    useBoardLifecycleStore: vi.fn((selector) =>
      selector({
        boardIsReachable: true,
        selectedConnectedBoard: undefined,
      }),
    ),
  };
});

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  );

  return {
    ...actual,
    useNavigate: (): (() => void) => vi.fn(),
  };
});

vi.mock('../../features/notifications', async () => {
  const actual = await vi.importActual<
    typeof import('../../features/notifications')
  >('../../features/notifications');

  return {
    ...actual,
    sendAppLabNotification: vi.fn(),
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
      getAIModels: vi.fn(),
      getEIProjects: vi.fn(),
      uploadAIModel: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);
const notifications = vi.mocked(await import('../../features/notifications'));

const MODEL_ID = 'llamacpp:gemma-3-1b-it-Q4_0';

type ScriptedEvent = { event: string; data: string };

/**
 * Replays a scripted SSE conversation the way `@microsoft/fetch-event-source`
 * does, which is what makes these tests meaningful: the library dispatches
 * `onmessage` for *every* event — including payload-less keep-alives — and an
 * exception thrown out of the handler tears the stream down, invokes `onerror`
 * and re-issues the request.
 */
const replayStream =
  (events: ScriptedEvent[]) =>
  async (_id: string, handlers: EventSourceHandlers): Promise<void> => {
    try {
      for (const event of events) {
        handlers.onmessage?.({ id: '', event: event.event, data: event.data });
      }
      handlers.onclose?.();
    } catch (error) {
      handlers.onerror?.(error as Error);
      throw error;
    }
  };

const createWrapper = () =>
  function AiModelsTestWrapper({ children }: PropsWithChildren): JSX.Element {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

beforeEach(() => {
  vi.clearAllMocks();

  domainServices.getAIModels.mockResolvedValue([]);
  domainServices.getEIProjects.mockResolvedValue([]);
});

describe('useAiModelsLogic - downloadAIModelSSE', () => {
  it('completes the download when the stream contains payload-less heartbeats', async () => {
    domainServices.uploadAIModel.mockImplementation(
      replayStream([
        {
          event: StreamEventType.Progress,
          data: JSON.stringify({ progress: 3.78 }),
        },
        // Keep-alives carry no `data:` field at all.
        { event: 'heartbeat', data: '' },
        { event: 'heartbeat', data: '' },
        {
          event: StreamEventType.Progress,
          data: JSON.stringify({ progress: 13.07 }),
        },
        {
          event: StreamEventType.Message,
          data: JSON.stringify({ message: 'download complete' }),
        },
        { event: StreamEventType.Done, data: '"download complete"' },
        {
          event: StreamEventType.Error,
          data: JSON.stringify({ code: 'SERVER_CLOSED' }),
        },
        { event: StreamEventType.Close, data: '"Stream closed by server"' },
      ]),
    );

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.downloadAIModelSSE(MODEL_ID);
    });

    expect(succeeded).toBe(true);
    // The request must not be re-issued: each retry restarts the install on the
    // board.
    expect(domainServices.uploadAIModel).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.currentDownloads?.[MODEL_ID]).toEqual(
        expect.objectContaining({
          isDownloading: false,
          error: false,
          success: true,
          percentage: 100,
        }),
      );
    });

    expect(notifications.sendAppLabNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('marks the download as failed once the stream gives up', async () => {
    domainServices.uploadAIModel.mockRejectedValue(
      new Error('Max retries exceeded'),
    );

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.downloadAIModelSSE(MODEL_ID);
    });

    expect(succeeded).toBe(false);

    await waitFor(() => {
      expect(result.current.currentDownloads?.[MODEL_ID]).toEqual(
        expect.objectContaining({
          isDownloading: false,
          error: true,
          success: false,
          percentage: 0,
        }),
      );
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });
});
