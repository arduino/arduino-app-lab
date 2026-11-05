import { StreamEventType } from '@cloud-editor-mono/infrastructure';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { createIntl } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const startReleaseBuild = vi.fn();
const chooseReleaseSavePath = vi.fn();
const writeReleaseFile = vi.fn();
const getReleaseBuildEvents = vi.fn();
const prepareApp = vi.fn();
const sendAppLabNotification = vi.fn();
const setNotification = vi.fn();
const removeNotification = vi.fn();

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    startReleaseBuild: (...args: unknown[]) => startReleaseBuild(...args),
    chooseReleaseSavePath: (...args: unknown[]) =>
      chooseReleaseSavePath(...args),
    writeReleaseFile: (...args: unknown[]) => writeReleaseFile(...args),
    getReleaseBuildEvents: (...args: unknown[]) =>
      getReleaseBuildEvents(...args),
    prepareApp: (...args: unknown[]) => prepareApp(...args),
  }),
);

vi.mock('../../features/notifications', () => ({
  sendAppLabNotification: (...args: unknown[]) =>
    sendAppLabNotification(...args),
}));

vi.mock('../footer-notifications/footerNotificationsContext', () => ({
  useFooterNotifications: () => ({ setNotification, removeNotification }),
}));

// The real formatter, so plural titles read as a user sees them.
vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  () => {
    const intl = createIntl({ locale: 'en', onError: () => undefined });
    return { useI18n: () => ({ formatMessage: intl.formatMessage }) };
  },
);

import { BoardScopedQuery } from '../../boardScopedQuery';
import { useRelease } from './releaseContextProvider.logic';

let queryClient = new QueryClient();

const wrapper = ({ children }: PropsWithChildren): JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

type Handlers = {
  onopen?: () => Promise<void>;
  onmessage?: (e: { event: string; data: string }) => void;
};

const releaseName = 'Magic Storyteller 2026-07-17 15:40';
const params = {
  appId: 'app-1',
  releaseName,
  fileName: 'Magic_Storyteller_2026-07-17_15-40.ard',
  body: { include_data: false, target: 'unoq' },
};

// The build id is the client's, so the assertions read it off the request.
const sentBuildId = (call = 0): string =>
  startReleaseBuild.mock.calls[call][1] as string;

let buildStream: Handlers = {};

const emit = (event: string, payload: object, handlers = buildStream): void =>
  act(() => handlers.onmessage?.({ event, data: JSON.stringify(payload) }));

const progress = (name: string, value: number, call = 0): void =>
  emit(StreamEventType.Progress, {
    build_id: sentBuildId(call),
    name,
    progress: value,
  });

const deferred = <T,>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const startBuild = async (
  result: { current: ReturnType<typeof useRelease> },
  overrides: Partial<typeof params> = {},
): Promise<{ dialog: Promise<void> }> => {
  const before = startReleaseBuild.mock.calls.length;
  let dialog: Promise<void> = Promise.resolve();
  act(() => {
    dialog = result.current.startReleaseBuild({ ...params, ...overrides });
  });
  await waitFor(() =>
    expect(startReleaseBuild.mock.calls.length).toBeGreaterThan(before),
  );
  // Wrapped: an async function would wait for the promise it returns.
  return { dialog };
};

describe('useRelease', () => {
  // The build request answers with the archive, the Save dialog with a path.
  let build: ReturnType<typeof deferred<Blob>>;
  let save: ReturnType<typeof deferred<string | undefined>>;
  const releaseArchive = new Blob(['archive bytes']);
  const sentAbort = (call = 0): AbortSignal =>
    (startReleaseBuild.mock.calls[call][3] as AbortController).signal;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    buildStream = {};
    build = deferred<Blob>();
    save = deferred<string | undefined>();
    startReleaseBuild.mockReturnValue(build.promise);
    chooseReleaseSavePath.mockReturnValue(save.promise);
    writeReleaseFile.mockResolvedValue(undefined);
    getReleaseBuildEvents.mockImplementation(
      (handlers: Handlers) =>
        new Promise<void>(() => {
          buildStream = handlers;
          void handlers.onopen?.();
        }),
    );
  });

  it('opens the events stream before it starts the build', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);

    expect(getReleaseBuildEvents).toHaveBeenCalledTimes(1);
    expect(startReleaseBuild).toHaveBeenCalledWith(
      'app-1',
      expect.any(String),
      params.body,
      expect.any(AbortController),
    );
    expect(result.current.isBuildingApp('app-1')).toBe(true);
    expect(result.current.isBuildingApp('app-2')).toBe(false);
  });

  it('holds the form over the copy step, then asks where to save', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    const { dialog } = await startBuild(result);
    let released = false;
    void dialog.then(() => {
      released = true;
    });

    progress('copying the app', 0);
    await Promise.resolve();
    expect(released).toBe(false);
    expect(result.current.bannerProps).toEqual([]);
    expect(chooseReleaseSavePath).not.toHaveBeenCalled();

    progress('compose files', 10);
    await dialog;

    expect(chooseReleaseSavePath).toHaveBeenCalledWith(params.fileName);
    await waitFor(() =>
      expect(result.current.bannerProps).toMatchObject([
        {
          type: 'operation',
          title: 'Saving release',
          description:
            "This takes few moments, we will update you when it's done.",
          rows: [{ label: `Building “${releaseName}”`, progress: 10 }],
        },
      ]),
    );
    expect(
      result.current.bannerProps[0].type === 'operation' &&
        result.current.bannerProps[0].actions?.map((a) => a.label),
    ).toEqual([`Stop ${releaseName}`, 'Hide in notifications']);
  });

  it('asks where to save when the copy step is followed by done', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    const { dialog } = await startBuild(result);
    progress('copying the app', 0);
    emit(StreamEventType.Done, { build_id: sentBuildId() });

    await dialog;
    expect(chooseReleaseSavePath).toHaveBeenCalledWith(params.fileName);
  });

  it('asks where to save when the archive arrives with no later step', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    const { dialog } = await startBuild(result);
    progress('copying the app', 0);

    await act(async () => build.resolve(releaseArchive));
    await dialog;
    expect(chooseReleaseSavePath).toHaveBeenCalledTimes(1);

    await act(async () => save.resolve('/home/user/release.ard'));
    expect(writeReleaseFile).toHaveBeenCalledWith(
      '/home/user/release.ard',
      releaseArchive,
    );
  });

  it('reports the download once the archive is where the user chose', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);
    progress('python environment', 20);
    progress('archive', 90);

    await waitFor(() =>
      expect(result.current.bannerProps).toMatchObject([
        { rows: [{ label: `Downloading “${releaseName}”`, progress: 90 }] },
      ]),
    );

    await act(async () => save.resolve('/home/user/release.ard'));
    expect(writeReleaseFile).not.toHaveBeenCalled();
    await act(async () => build.resolve(releaseArchive));

    expect(writeReleaseFile).toHaveBeenCalledWith(
      '/home/user/release.ard',
      releaseArchive,
    );
    expect(result.current.bannerProps).toEqual([]);
    expect(result.current.isBuildingApp('app-1')).toBe(false);
    expect(sendAppLabNotification).toHaveBeenCalledWith({
      message: `${releaseName} successfully downloaded`,
      variant: 'success',
    });
  });

  it('ends quietly when the user closes the save dialog', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);
    progress('compose files', 10);

    await act(async () => save.resolve(undefined));

    expect(sentAbort().aborted).toBe(true);
    expect(result.current.bannerProps).toEqual([]);
    expect(sendAppLabNotification).not.toHaveBeenCalled();
  });

  it('offers the build log when the build fails', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    const { dialog } = await startBuild(result);
    emit(StreamEventType.Message, {
      build_id: sentBuildId(),
      message: 'building sketch',
    });
    emit(StreamEventType.Error, {
      build_id: sentBuildId(),
      code: 'INTERNAL_SERVER_ERROR',
      message: "sketch.ino:14:3: error: 'VOICES' was not declared",
    });

    await expect(dialog).resolves.toBeUndefined();
    expect(sentAbort().aborted).toBe(true);
    expect(result.current.bannerProps).toEqual([]);

    const [{ message, variant, duration, actions }] = sendAppLabNotification
      .mock.calls[0] as [
      {
        message: string;
        variant: string;
        duration: number;
        actions: {
          text: string;
          onClick: (p: { dismiss: () => void }) => void;
        }[];
      },
    ];
    expect(message).toBe(`Couldn’t create ${releaseName}`);
    expect(variant).toBe('error');
    expect(duration).toBe(Infinity);
    expect(actions[0].text).toBe('View log');

    act(() => actions[0].onClick({ dismiss: vi.fn() }));
    expect(result.current.buildLog).toEqual([
      { text: 'building sketch', kind: 'info' },
      {
        text: "sketch.ino:14:3: error: 'VOICES' was not declared",
        kind: 'error',
      },
    ]);
  });

  it('fails the build the daemon refuses to start', async () => {
    startReleaseBuild.mockRejectedValue(new Error('the app is not found'));
    const { result } = renderHook(() => useRelease(), { wrapper });
    const { dialog } = await startBuild(result);

    await expect(dialog).resolves.toBeUndefined();
    await waitFor(() =>
      expect(sendAppLabNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      ),
    );
    expect(result.current.isBuildingApp('app-1')).toBe(false);
  });

  it('ignores the events of a build it did not start', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    const { dialog } = await startBuild(result);
    let released = false;
    void dialog.then(() => {
      released = true;
    });

    emit(StreamEventType.Error, {
      build_id: 'someone-elses-build',
      code: 'X',
    });
    emit(StreamEventType.Progress, {
      build_id: 'someone-elses-build',
      name: 'archive',
      progress: 90,
    });
    await Promise.resolve();

    expect(released).toBe(false);
    expect(sendAppLabNotification).not.toHaveBeenCalled();
    expect(result.current.isBuildingApp('app-1')).toBe(true);
  });

  it('follows builds of two Apps on one stream and one card', async () => {
    chooseReleaseSavePath.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);
    progress('compose files', 10);
    await startBuild(result, {
      appId: 'app-2',
      releaseName: 'Ghostwriter 2026-07-17 16:10',
    });
    progress('python environment', 20, 1);

    expect(getReleaseBuildEvents).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(result.current.bannerProps).toMatchObject([
        {
          title: 'Saving releases',
          rows: [
            { label: `Building “${releaseName}”` },
            { label: 'Building “Ghostwriter 2026-07-17 16:10”' },
          ],
        },
      ]),
    );
    expect(
      result.current.bannerProps[0].type === 'operation' &&
        result.current.bannerProps[0].actions?.map((a) => a.label),
    ).toEqual([
      `Stop ${releaseName}`,
      'Stop Ghostwriter 2026-07-17 16:10',
      'Hide in notifications',
    ]);
  });

  it('stops a build without reporting the failure the stop causes', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);
    progress('compose files', 10);
    await waitFor(() => expect(result.current.bannerProps).toHaveLength(1));

    const stop =
      result.current.bannerProps[0].type === 'operation'
        ? result.current.bannerProps[0].actions?.find((a) =>
            a.id.startsWith('stop-'),
          )
        : undefined;
    act(() => stop?.onSelect());
    await act(async () =>
      build.reject(new Error('The user aborted a request.')),
    );
    await act(async () => save.resolve('/home/user/release.ard'));

    expect(sentAbort().aborted).toBe(true);
    expect(writeReleaseFile).not.toHaveBeenCalled();
    expect(result.current.bannerProps).toEqual([]);
    expect(sendAppLabNotification).toHaveBeenCalledTimes(1);
    expect(sendAppLabNotification).toHaveBeenCalledWith({
      message: `Stopped creating ${releaseName}`,
      variant: 'warning',
    });
  });

  it('lists a hidden build in the notifications panel until it ends', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);
    progress('compose files', 10);
    await waitFor(() => expect(result.current.bannerProps).toHaveLength(1));

    const hide =
      result.current.bannerProps[0].type === 'operation'
        ? result.current.bannerProps[0].actions?.find((a) => a.id === 'hide')
        : undefined;
    act(() => hide?.onSelect());

    expect(result.current.bannerProps).toEqual([]);
    expect(setNotification).toHaveBeenCalledTimes(1);
    expect(setNotification).toHaveBeenCalledWith(
      expect.objectContaining({ label: `Saving ${releaseName}` }),
    );
    const { id } = setNotification.mock.calls[0][0];

    progress('compose files', 40);
    expect(setNotification).toHaveBeenCalledTimes(1);

    await act(async () => save.resolve('/home/user/release.ard'));
    await act(async () => build.resolve(releaseArchive));
    expect(removeNotification).toHaveBeenCalledWith(id);
  });

  it('shows the card again from its notifications panel entry', async () => {
    const { result } = renderHook(() => useRelease(), { wrapper });
    await startBuild(result);
    progress('compose files', 10);
    await waitFor(() => expect(result.current.bannerProps).toHaveLength(1));

    const hide =
      result.current.bannerProps[0].type === 'operation'
        ? result.current.bannerProps[0].actions?.find((a) => a.id === 'hide')
        : undefined;
    act(() => hide?.onSelect());
    const { id, onClick } = setNotification.mock.calls[0][0];
    act(() => onClick());

    expect(result.current.bannerProps).toHaveLength(1);
    expect(removeNotification).toHaveBeenCalledWith(id);
  });

  describe('preparation', () => {
    let prepareStream: Handlers = {};

    beforeEach(() => {
      prepareStream = {};
      prepareApp.mockImplementation(
        (_id: string, handlers: Handlers) =>
          new Promise<void>(() => {
            prepareStream = handlers;
          }),
      );
    });

    it('names the App in its card', async () => {
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() => result.current.startPreparation('app-1', 'Magic Storyteller'));
      emit(
        StreamEventType.Progress,
        { name: 'containers', progress: 24.6 },
        prepareStream,
      );

      await waitFor(() =>
        expect(result.current.bannerProps).toMatchObject([
          {
            title: 'Getting Magic Storyteller ready',
            description: "We will update you when it's done.",
            rows: [{ label: 'Downloading Bricks and models…', progress: 25 }],
          },
        ]),
      );
      expect(
        result.current.bannerProps[0].type === 'operation' &&
          result.current.bannerProps[0].actions?.map((a) => a.label),
      ).toEqual(['Hide in notifications']);
    });

    it('lists a hidden preparation and restores its card from notifications', async () => {
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() => result.current.startPreparation('app-1', 'Magic Storyteller'));

      const hide =
        result.current.bannerProps[0].type === 'operation'
          ? result.current.bannerProps[0].actions?.find((a) => a.id === 'hide')
          : undefined;
      act(() => hide?.onSelect());

      expect(result.current.bannerProps).toEqual([]);
      expect(setNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Getting Magic Storyteller ready',
          onClick: expect.any(Function),
        }),
      );

      const { id, onClick } = setNotification.mock.calls[0][0];
      act(() => onClick());
      expect(result.current.bannerProps).toHaveLength(1);
      expect(removeNotification).toHaveBeenCalledWith(id);
    });

    it('reports success once, ignoring the closing error after done', async () => {
      const onPrepared = vi.fn();
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() =>
        result.current.startPreparation('app-1', 'Magic Storyteller', {
          onPrepared,
        }),
      );
      await waitFor(() => expect(prepareApp).toHaveBeenCalled());

      emit(StreamEventType.Done, { id: 'app-1' }, prepareStream);
      emit(StreamEventType.Error, { code: 'SERVER_CLOSED' }, prepareStream);

      expect(result.current.bannerProps).toEqual([]);
      expect(onPrepared).toHaveBeenCalledTimes(1);
      expect(sendAppLabNotification).toHaveBeenCalledTimes(1);
      expect(sendAppLabNotification).toHaveBeenCalledWith({
        message: 'App dependencies installed successfully',
        variant: 'success',
      });
    });

    it('reports the message the caller gives on success', async () => {
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() =>
        result.current.startPreparation('app-1', 'Magic Storyteller', {
          successMessage: 'Magic Storyteller correctly imported',
        }),
      );
      await waitFor(() => expect(prepareApp).toHaveBeenCalled());

      emit(StreamEventType.Done, { id: 'app-1' }, prepareStream);

      expect(sendAppLabNotification).toHaveBeenCalledTimes(1);
      expect(sendAppLabNotification).toHaveBeenCalledWith({
        message: 'Magic Storyteller correctly imported',
        variant: 'success',
      });
    });

    it('refreshes the model lists once the models are installed', async () => {
      const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() => result.current.startPreparation('app-1', 'Magic Storyteller'));
      await waitFor(() => expect(prepareApp).toHaveBeenCalled());

      emit(StreamEventType.Done, { id: 'app-1' }, prepareStream);

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [BoardScopedQuery.GET_INSTALLED_MODELS],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [BoardScopedQuery.GET_BRICK_DETAILS],
      });
    });

    it('refreshes the model lists when the preparation fails', async () => {
      const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() => result.current.startPreparation('app-1', 'Magic Storyteller'));
      await waitFor(() => expect(prepareApp).toHaveBeenCalled());

      emit(
        StreamEventType.Error,
        { code: 'INTERNAL_SERVER_ERROR', message: 'no network' },
        prepareStream,
      );

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [BoardScopedQuery.GET_INSTALLED_MODELS],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [BoardScopedQuery.GET_BRICK_DETAILS],
      });
    });

    it('reports a failed download', async () => {
      const onPrepared = vi.fn();
      const { result } = renderHook(() => useRelease(), { wrapper });
      act(() =>
        result.current.startPreparation('app-1', 'Magic Storyteller', {
          onPrepared,
        }),
      );
      await waitFor(() => expect(prepareApp).toHaveBeenCalled());

      emit(
        StreamEventType.Error,
        { code: 'INTERNAL_SERVER_ERROR', message: 'no network' },
        prepareStream,
      );

      expect(onPrepared).not.toHaveBeenCalled();
      expect(sendAppLabNotification).toHaveBeenCalledWith({
        message: 'Couldn’t install the dependencies of Magic Storyteller',
        variant: 'error',
      });
    });
  });
});
