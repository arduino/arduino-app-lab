import {
  AIModelItem,
  EventSourceFatalError,
  EventSourceHandlers,
  StreamEventType,
} from '@cloud-editor-mono/infrastructure';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useAiModelsLogic } from './aiModelsContextProvider.logic';
import { aiModelsMessages } from './messages';

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
      installAIModel: vi.fn(),
      downloadAIModel: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);
const notifications = vi.mocked(await import('../../features/notifications'));

const MODEL_ID = 'llamacpp:Qwen3.5-2B-Q4_K_M';

// A Hugging Face source is the file URL that was pasted, not an id: the id is
// assigned by the downloader and only reported on the `done` event.
const HF_SOURCE =
  'https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/blob/main/SmolLM2-135M-Instruct-Q4_K_M.gguf';

// An id the board's list does not declare carries the repository path the model
// was downloaded from, and comes back with the `user` origin.
const HF_INSTALLED_MODEL: AIModelItem = {
  id: 'llamacpp:unsloth/SmolLM2-135M-Instruct-GGUF/SmolLM2-135M-Instruct-Q4_K_M',
  id_decoded:
    'llamacpp:unsloth/SmolLM2-135M-Instruct-GGUF/SmolLM2-135M-Instruct-Q4_K_M',
  name: 'unsloth/SmolLM2-135M-Instruct-GGUF/SmolLM2-135M-Instruct-Q4_K_M',
  description: '',
  runner: '',
  brick_ids: ['arduino:llm'],
  is_builtin: false,
  origin: 'user',
  size: 105455288,
  status: 'installed',
};

// The install route answers `done` with the model it installed, which for a
// declared id is the one the caller asked for.
const DECLARED_MODEL: AIModelItem = {
  id: MODEL_ID,
  id_decoded: MODEL_ID,
  name: 'Qwen3.5-2B-Q4_K_M',
  description: '',
  runner: '',
  brick_ids: ['arduino:llm'],
  is_builtin: true,
  origin: 'curated',
  status: 'installed',
};

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

/**
 * Scripts the same SSE conversation onto both install routes.
 *
 * The daemon splits them — `installAIModel` is `PUT /v1/models/{id}` for a
 * declared id, `downloadAIModel` is `POST /v1/models` for a url — but every
 * test here is about how the stream is consumed, not which verb carried it.
 * Scripting both keeps each test free to name whichever target reads clearest.
 */
const scriptStream = (events: ScriptedEvent[]): void => {
  domainServices.installAIModel.mockImplementation(replayStream(events));
  domainServices.downloadAIModel.mockImplementation(replayStream(events));
};

beforeEach(() => {
  vi.clearAllMocks();

  domainServices.getAIModels.mockResolvedValue([]);
  domainServices.getEIProjects.mockResolvedValue([]);
});

describe('useAiModelsLogic - downloadAIModelSSE', () => {
  // The daemon splits the two routes and each rejects the other's input: PUT
  // 404s on an id it does not declare, POST wants a url in its body. Calling
  // the wrong one fails on the board, not here, so pin which service each hits.
  describe('each function uses its own route', () => {
    const doneOnly: ScriptedEvent[] = [
      { event: StreamEventType.Done, data: JSON.stringify(HF_INSTALLED_MODEL) },
    ];

    it('installAIModelSSE installs by id and never posts a download', async () => {
      scriptStream(doneOnly);

      const { result } = renderHook(() => useAiModelsLogic(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.installAIModelSSE(MODEL_ID);
      });

      expect(domainServices.installAIModel).toHaveBeenCalledTimes(1);
      expect(domainServices.installAIModel.mock.calls[0][0]).toBe(MODEL_ID);
      expect(domainServices.downloadAIModel).not.toHaveBeenCalled();
    });

    it('downloadAIModelSSE posts the url and never installs it as an id', async () => {
      scriptStream(doneOnly);

      const { result } = renderHook(() => useAiModelsLogic(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.downloadAIModelSSE(HF_SOURCE);
      });

      expect(domainServices.downloadAIModel).toHaveBeenCalledTimes(1);
      expect(domainServices.downloadAIModel.mock.calls[0][0]).toBe(HF_SOURCE);
      expect(domainServices.installAIModel).not.toHaveBeenCalled();
    });

    it('passes the mmproj url only the download route can carry', async () => {
      scriptStream(doneOnly);

      const { result } = renderHook(() => useAiModelsLogic(), {
        wrapper: createWrapper(),
      });

      const mmprojUrl = `https://huggingface.co/org/repo/resolve/main/mmproj-F16.gguf`;

      await act(async () => {
        await result.current.downloadAIModelSSE(HF_SOURCE, { mmprojUrl });
      });

      expect(domainServices.downloadAIModel.mock.calls[0][3]).toBe(mmprojUrl);
    });
  });

  it('completes the download when the stream contains payload-less heartbeats', async () => {
    scriptStream([
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
      { event: StreamEventType.Done, data: JSON.stringify(DECLARED_MODEL) },
      {
        event: StreamEventType.Error,
        data: JSON.stringify({ code: 'SERVER_CLOSED' }),
      },
      { event: StreamEventType.Close, data: '"Stream closed by server"' },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.installAIModelSSE(MODEL_ID);
    });

    expect(installed?.id).toBe(MODEL_ID);
    // The request must not be re-issued: each retry restarts the install on the
    // board.
    expect(domainServices.installAIModel).toHaveBeenCalledTimes(1);

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

  it('takes the installed model of a Hugging Face source from the done event', async () => {
    scriptStream([
      {
        event: StreamEventType.Message,
        data: JSON.stringify({ message: 'Downloading to: /models/llamacpp' }),
      },
      {
        event: StreamEventType.Progress,
        data: JSON.stringify({
          name: 'SmolLM2-135M-Instruct-Q4_K_M.gguf',
          current: 75876627,
          total: 105454144,
          progress: 71.95,
        }),
      },
      {
        event: StreamEventType.Done,
        data: JSON.stringify(HF_INSTALLED_MODEL),
      },
    ]);

    const declaredModel: AIModelItem = {
      ...DECLARED_MODEL,
      status: 'not-installed',
    };
    domainServices.getAIModels.mockResolvedValue([declaredModel]);

    const onStarted = vi.fn();
    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    // Let the installed-models query settle first, so the upsert below is not
    // racing the response that would replace the whole list.
    await waitFor(() => {
      expect(result.current.installedModels).toEqual([declaredModel]);
    });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.downloadAIModelSSE(HF_SOURCE, {
        onStarted,
      });
    });

    // The id in the request path is not the id of the installed model.
    expect(installed).toEqual(HF_INSTALLED_MODEL);
    expect(onStarted).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.currentDownloads?.[HF_SOURCE]).toEqual(
        expect.objectContaining({ success: true, percentage: 100 }),
      );
    });

    // The `done` payload matches `GET /v1/models/{id}`, so the model list is
    // brought up to date from it rather than refetched. A model installed from
    // a Hugging Face source is not in that list at all yet, so it is added
    // rather than updated in place.
    await waitFor(() => {
      expect(result.current.installedModels).toEqual([
        declaredModel,
        HF_INSTALLED_MODEL,
      ]);
    });
  });

  it('says a model is already installed when a key names a file the board has', async () => {
    scriptStream([
      {
        event: StreamEventType.Done,
        data: JSON.stringify(HF_INSTALLED_MODEL),
      },
    ]);
    domainServices.getAIModels.mockResolvedValue([HF_INSTALLED_MODEL]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.installedModels).toEqual([HF_INSTALLED_MODEL]);
    });

    await act(async () => {
      await result.current.downloadAIModelSSE(
        'llamacpp:unsloth/SmolLM2-135M-Instruct-GGUF:Q4_K_M',
      );
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith({
      message: aiModelsMessages.modelAlreadyInstalled.defaultMessage,
      variant: 'info',
    });
    expect(notifications.sendAppLabNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('does not treat a completion message or a full progress bar as the end of the install', async () => {
    // A vision model downloads two files, so `progress` reaches 100 once per
    // file, and the downloader's own "download complete" arrives as a
    // `message`. Neither ends the install: only `done` does.
    scriptStream([
      {
        event: StreamEventType.Progress,
        data: JSON.stringify({
          name: 'SmolVLM-256M-Instruct-Q8_0.gguf',
          current: 105454144,
          total: 105454144,
          progress: 100,
        }),
      },
      {
        event: StreamEventType.Message,
        data: JSON.stringify({ message: 'download complete' }),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.downloadAIModelSSE(HF_SOURCE);
    });

    expect(installed).toBeUndefined();
    expect(notifications.sendAppLabNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );

    // A stream that ends without `done` still has to release the card, or it
    // keeps showing a progress bar for a download that is over.
    await waitFor(() => {
      expect(result.current.currentDownloads?.[HF_SOURCE]).toEqual(
        expect.objectContaining({ isDownloading: false, success: false }),
      );
    });
  });

  // Every released daemon answers `done` with `GetDone()`, a log line, and
  // never with the model, so nothing completes the install from the stream
  // alone. A declared id is completed from the entry the listing already holds.
  it('completes an install when an older daemon answers done with a log line', async () => {
    const notInstalled = {
      ...DECLARED_MODEL,
      status: 'not-installed' as const,
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(
      [BoardScopedQuery.GET_INSTALLED_MODELS],
      [notInstalled],
    );
    const wrapper = ({ children }: PropsWithChildren): JSX.Element => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    scriptStream([
      {
        event: StreamEventType.Progress,
        data: JSON.stringify({
          name: MODEL_ID,
          current: 105454144,
          total: 105454144,
          progress: 100,
        }),
      },
      {
        event: StreamEventType.Done,
        data: JSON.stringify('Extracted to /models/llamacpp/Qwen3.5-2B-Q4_K_M'),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), { wrapper });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.installAIModelSSE(MODEL_ID);
    });

    // Returning the model is what selects it for the brick: the callers skip
    // `updateModelInUse` without one.
    expect(installed).toEqual(DECLARED_MODEL);
    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  // Completing on the id alone would invent a model: the listing entry is what
  // carries the name, the runner and the bricks the model can serve.
  it('stays failed when the listing holds no entry for the id', async () => {
    scriptStream([
      {
        event: StreamEventType.Progress,
        data: JSON.stringify({
          name: MODEL_ID,
          current: 105454144,
          total: 105454144,
          progress: 100,
        }),
      },
      {
        event: StreamEventType.Done,
        data: JSON.stringify('Extracted to /models/llamacpp/Qwen3.5-2B-Q4_K_M'),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.installAIModelSSE(MODEL_ID);
    });

    expect(installed).toBeUndefined();
    await waitFor(() =>
      expect(result.current.currentDownloads?.[MODEL_ID]).toEqual(
        expect.objectContaining({ isDownloading: false, success: false }),
      ),
    );
  });

  it('reports a downloader error that arrives as a bare string', async () => {
    const downloaderError =
      "Hugging Face model repository 'unsloth/nope' does not exist, or is not public.";

    scriptStream([
      { event: StreamEventType.Error, data: JSON.stringify(downloaderError) },
    ]);

    const onError = vi.fn();
    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.downloadAIModelSSE(HF_SOURCE, {
        onError,
      });
    });

    expect(installed).toBeUndefined();
    // The download never started, so the caller waiting on it reports the
    // reason itself instead of it going to the footer.
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: downloaderError }),
    );
    expect(notifications.sendAppLabNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('does not count a message as the download having started', async () => {
    // The downloader's opening line names the directory it will write to,
    // derived from the URL without contacting Hugging Face, so it arrives even
    // for a repo that does not exist. Treating it as "started" would close the
    // link-model dialog before the error, pushing the one message the user
    // needs into the footer instead of the field they can correct.
    const downloaderError =
      "Hugging Face model repository 'unsloth/nope' does not exist, or is not public.";

    scriptStream([
      {
        event: StreamEventType.Message,
        data: JSON.stringify({
          message: 'Downloading to: /models/llamacpp/unsloth/nope',
        }),
      },
      { event: StreamEventType.Error, data: JSON.stringify(downloaderError) },
    ]);

    const onStarted = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.downloadAIModelSSE(HF_SOURCE, {
        onStarted,
        onError,
      });
    });

    expect(onStarted).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: downloaderError }),
    );
    expect(notifications.sendAppLabNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('reports a daemon error that arrives as an object', async () => {
    scriptStream([
      {
        event: StreamEventType.Error,
        data: JSON.stringify({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'download named no model',
        }),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.installAIModelSSE(MODEL_ID);
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: 'download named no model',
      }),
    );
  });

  it('reports running out of disk in our own wording', async () => {
    // The daemon cannot answer 507 here — it only checks disk space inside
    // `Download()`, which runs after the SSE stream has already committed a
    // 200 — so it reports the code in-band and we map it to the same wording
    // the Edge Impulse install path uses.
    scriptStream([
      {
        event: StreamEventType.Error,
        data: JSON.stringify({
          code: 'insufficient_storage',
          message: 'insufficient disk space to install model',
        }),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.installAIModelSSE(MODEL_ID);
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: 'Insufficient space on the board.',
      }),
    );
  });

  it.each([
    ['invalid_model_url', 'The link is not a Hugging Face GGUF model.'],
    [
      'model_not_found',
      'The model does not exist on Hugging Face, or it is not public.',
    ],
    [
      'model_private_or_gated',
      'The model is private or gated. Only public models can be downloaded.',
    ],
    ['model_disabled', 'The authors disabled this model on Hugging Face.'],
    ['model_incompatible', 'The board does not support this model.'],
    ['no_compatible_file', 'The repository has no GGUF model file.'],
    [
      'hub_unreachable',
      'The board cannot reach Hugging Face. Check its internet connection.',
    ],
  ])('reports the %s code in our own wording', async (code, message) => {
    scriptStream([
      {
        event: StreamEventType.Error,
        data: JSON.stringify({ code, message: 'downloader text' }),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.downloadAIModelSSE(HF_SOURCE);
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message }),
    );
  });

  it('reports the downloader text for a code it does not know', async () => {
    scriptStream([
      {
        event: StreamEventType.Error,
        data: JSON.stringify({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'downloader text',
        }),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.downloadAIModelSSE(HF_SOURCE);
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error', message: 'downloader text' }),
    );
  });

  it('asks the user to update App Lab when the daemon has no download route', async () => {
    // `POST /v1/models` only exists from arduino-app-cli 5.9.3: an older
    // daemon answers 405, which is not something the user can correct in the
    // link-model dialog, so it is reported as an update prompt instead.
    domainServices.downloadAIModel.mockRejectedValue(
      new EventSourceFatalError(405),
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.downloadAIModelSSE(HF_SOURCE, { onError });
    });

    expect(notifications.sendAppLabNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'info',
        message: 'Update App Lab in Settings to link a model.',
        actions: [
          expect.objectContaining({
            text: 'Go to settings',
            onClick: expect.any(Function),
          }),
        ],
      }),
    );
    expect(notifications.sendAppLabNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
    // The caller still hears about it, so the dialog can stop spinning.
    expect(onError).toHaveBeenCalledWith(expect.any(EventSourceFatalError));
  });

  it('names the brick that linked the model, and forgets the download on request', async () => {
    // A user-linked model is nowhere in the board's brick list until it is
    // installed, so the brick detail rebuilds its downloading row out of this
    // record every time the view is mounted — which is what makes the progress
    // survive leaving the app and coming back. The record therefore has to say
    // which brick detail asked for it, and has to be dropped once the real row
    // can take over.
    let openHandlers: EventSourceHandlers | undefined;
    let closeStream: () => void = () => undefined;
    const streamClosed = new Promise<void>((resolve) => {
      closeStream = resolve;
    });

    domainServices.downloadAIModel.mockImplementation(
      async (_url: string, handlers: EventSourceHandlers) => {
        openHandlers = handlers;
        await streamClosed;
      },
    );

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let download: Promise<AIModelItem | undefined> | undefined;
    await act(async () => {
      download = result.current.downloadAIModelSSE(HF_SOURCE, {
        linkedBrickId: 'arduino:llm',
      });
    });

    // Nothing yet: a url that turns out not to exist must not put a row in the
    // list while the dialog is still reporting it.
    await waitFor(() => {
      expect(result.current.currentDownloads?.[HF_SOURCE]).toEqual(
        expect.objectContaining({ isDownloading: true }),
      );
    });
    expect(
      result.current.currentDownloads?.[HF_SOURCE]?.linkedBrickId,
    ).toBeUndefined();

    // The first byte makes the download real, and the brick survives every
    // update the stream writes after it.
    await act(async () => {
      openHandlers?.onmessage?.({
        id: '',
        event: StreamEventType.Progress,
        data: JSON.stringify({ progress: 42 }),
      });
    });

    expect(result.current.currentDownloads?.[HF_SOURCE]).toEqual(
      expect.objectContaining({
        percentage: 42,
        linkedBrickId: 'arduino:llm',
      }),
    );

    await act(async () => {
      openHandlers?.onmessage?.({
        id: '',
        event: StreamEventType.Done,
        data: JSON.stringify(HF_INSTALLED_MODEL),
      });
      closeStream();
      await download;
    });

    act(() => {
      result.current.clearDownload(HF_SOURCE);
    });

    expect(result.current.currentDownloads?.[HF_SOURCE]).toBeUndefined();
  });

  // Starting a second stream for the same source aborts the first, and
  // @microsoft/fetch-event-source resolves an aborted request like any other,
  // so the replaced stream reaches its own end-of-stream path.
  it('keeps a live download when the stream it replaced resolves', async () => {
    domainServices.downloadAIModel.mockImplementation(
      async (
        _url: string,
        _handlers: EventSourceHandlers,
        abortController?: AbortController,
      ) => {
        await new Promise<void>((resolve) => {
          abortController?.signal.addEventListener('abort', () => resolve());
        });
      },
    );

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    const onStarted = vi.fn();
    let superseded: Promise<AIModelItem | undefined> | undefined;
    await act(async () => {
      superseded = result.current.downloadAIModelSSE(HF_SOURCE, { onStarted });
    });

    await act(async () => {
      result.current.downloadAIModelSSE(HF_SOURCE);
      await superseded;
    });

    // The record belongs to the stream still running.
    expect(result.current.currentDownloads?.[HF_SOURCE]).toEqual(
      expect.objectContaining({ isDownloading: true }),
    );
    // The replaced stream never started, so its caller is not told it did.
    expect(onStarted).not.toHaveBeenCalled();

    // And the caller of the replaced stream cannot forget the live one.
    act(() => {
      result.current.clearDownload(HF_SOURCE);
    });
    expect(result.current.currentDownloads?.[HF_SOURCE]).toEqual(
      expect.objectContaining({ isDownloading: true }),
    );
  });

  // The stream is the only thing that says a download finished, and it can stop
  // saying anything: a dropped connection, a daemon restart, or a `done` whose
  // payload does not parse. The model may be on disk either way, so the cache
  // has to re-read rather than keep whatever it guessed.
  it('re-reads the installed models whenever a download fails', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren): JSX.Element => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    // A full progress bar and a completion message, and then the stream ends
    // with no `done`: the card is released as failed.
    scriptStream([
      {
        event: StreamEventType.Progress,
        data: JSON.stringify({
          name: 'SmolLM2-135M-Instruct-Q4_K_M.gguf',
          current: 105454144,
          total: 105454144,
          progress: 100,
        }),
      },
      {
        event: StreamEventType.Message,
        data: JSON.stringify({ message: 'download complete' }),
      },
    ]);

    const { result } = renderHook(() => useAiModelsLogic(), { wrapper });

    await act(async () => {
      await result.current.downloadAIModelSSE(HF_SOURCE);
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: [BoardScopedQuery.GET_INSTALLED_MODELS],
      }),
    );
  });

  it('marks the download as failed once the stream gives up', async () => {
    domainServices.installAIModel.mockRejectedValue(
      new Error('Max retries exceeded'),
    );

    const { result } = renderHook(() => useAiModelsLogic(), {
      wrapper: createWrapper(),
    });

    let installed: AIModelItem | undefined;
    await act(async () => {
      installed = await result.current.installAIModelSSE(MODEL_ID);
    });

    expect(installed).toBeUndefined();

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
