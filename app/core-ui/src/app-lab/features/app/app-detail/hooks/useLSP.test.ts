import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageServerContext } from '../../../../providers/language-server/languageServerContext';
import { useLSP } from './useLSP';

const h = vi.hoisted(() => ({
  initLspWorkspace: vi.fn((_path: string) => Promise.resolve()),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  (): Record<string, unknown> => ({
    eventsEmit: vi.fn(),
    eventsOn: vi.fn(() => (): void => undefined),
    // Never answers: the detail comes only from what a test puts in the cache.
    getAppDetail: vi.fn(() => new Promise(() => undefined)),
    getAppFileContent: vi.fn(),
    getLspTempWorkspaceAppDir: vi.fn(() => Promise.resolve('/tmp/ws/app')),
    getLspWorkspaceFile: vi.fn(),
    initLspWorkspace: h.initLspWorkspace,
    isLspEnabled: vi.fn(() => Promise.resolve(true)),
    sendLspMessage: vi.fn(),
    startLSP: vi.fn(),
    stopAllLSP: vi.fn(() => Promise.resolve()),
    isBoard: vi.fn(() => Promise.resolve(false)),
  }),
);

vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  (): Record<string, unknown> => ({
    dismissSnackbar: vi.fn(),
    fileNameFromUri: vi.fn(),
    isLspDebugEnabled: (): boolean => false,
    LSP_FAILED_EVENT: 'lsp-failed',
    LSP_LANGS: {},
    LSP_LOG_EVENT: 'lsp-log',
    LSP_SET_DEBUG_LOGGING_EVENT: 'lsp-debug',
    setLspDebug: vi.fn(),
    snackbar: vi.fn(),
    toDocOffset: vi.fn(),
    useI18n: () => ({ formatMessage: (m: { id: string }): string => m.id }),
  }),
);

const BLINK = {
  id: 'id-blink',
  name: 'blink',
  path: '/home/arduino/ArduinoApps/blink',
  description: 'Blink an LED',
  status: 'stopped',
};
const RENAMED = {
  ...BLINK,
  id: 'id-blink-fast',
  name: 'blink-fast',
  path: '/home/arduino/ArduinoApps/blink-fast',
};

const renderLsp = (): {
  client: QueryClient;
  rename: () => void;
} => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(['isBoard'], false);
  client.setQueryData(['is-lsp-enabled', 'fqbn'], true);
  client.setQueryData(['list-my-apps', BLINK.id], BLINK);
  const context = {
    lspState: { type: 'idle' },
    setLspStates: vi.fn(),
    resetLspState: vi.fn(),
  };
  const { rerender } = renderHook(
    ({ appId }: { appId: string }) =>
      useLSP(appId, { fqbn: 'fqbn' } as Parameters<typeof useLSP>[1]),
    {
      initialProps: { appId: BLINK.id },
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            LanguageServerContext.Provider,
            { value: context as never },
            children,
          ),
        ),
    },
  );
  const rename = (): void => {
    client.setQueryData(['list-my-apps', RENAMED.id], RENAMED);
    rerender({ appId: RENAMED.id });
  };
  return { client, rename };
};

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

beforeEach(() => {
  h.initLspWorkspace.mockReset();
  h.initLspWorkspace.mockImplementation(() => Promise.resolve());
});

// The copy replaces the workspace under the running language servers, and an edit that reaches one mid-copy breaks it.
describe('useLSP workspace copy', () => {
  it('copies on open and on a change to the files, not on an app edit', async () => {
    const { client, rename } = renderLsp();
    await settle();
    expect(h.initLspWorkspace.mock.calls).toEqual([[BLINK.path]]);

    rename();
    await settle();
    act(() => {
      client.setQueryData(['list-my-apps', RENAMED.id], {
        ...RENAMED,
        description: 'Blink it faster',
      });
    });
    await settle();
    expect(h.initLspWorkspace).toHaveBeenCalledTimes(1);

    act(() => {
      client.setQueryData(['list-my-apps', RENAMED.id], {
        ...RENAMED,
        status: 'running',
      });
    });
    await settle();
    expect(h.initLspWorkspace.mock.calls).toEqual([
      [BLINK.path],
      [RENAMED.path],
    ]);
  });

  it('copies again from the new folder when the rename lands during a copy', async () => {
    let finishFirstCopy: VoidFunction = () => undefined;
    h.initLspWorkspace.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirstCopy = resolve;
        }),
    );
    const { rename } = renderLsp();
    await settle();

    rename();
    await settle();
    await act(async () => finishFirstCopy());
    await settle();

    expect(h.initLspWorkspace.mock.calls).toEqual([
      [BLINK.path],
      [RENAMED.path],
    ]);
  });
});
