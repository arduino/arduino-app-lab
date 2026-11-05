/**
 * Unit tests for how useLSP routes file-tree and watcher changes to the
 * language-server workspaces. The workspaces are stubbed: these tests pin which
 * workspace method each change reaches, and with which paths. What each method
 * sends to the server is covered in lsp-client-workspace.test.ts.
 */

import {
  getAppDetail,
  initLspWorkspace,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import type {
  LspClientRef,
  LspClientWorkspace,
  LspId,
  LspReferencesResult,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ContextType, createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageServerContext } from '../../../../providers/language-server/languageServerContext';
import { useLspReferencesStore } from '../../../../store/lspReferences';
import { useLSP } from './useLSP';

const TEMP_WORKSPACE = '/tmp/ws/app';

const h = vi.hoisted(() => ({
  listLspFiles: vi.fn(
    async (_dir: string, _relDir: string): Promise<string[]> => [],
  ),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  () => ({
    eventsEmit: vi.fn(),
    eventsOn: vi.fn(() => (): void => undefined),
    getAppDetail: vi.fn(async () => ({
      path: '/home/arduino/ArduinoApps/app',
    })),
    getAppFileContent: vi.fn(async () => ''),
    getLspTempWorkspaceAppDir: vi.fn(async () => TEMP_WORKSPACE),
    getLspWorkspaceFile: vi.fn(async () => ''),
    initLspWorkspace: vi.fn(async () => undefined),
    isBoard: vi.fn(async () => false),
    isLspEnabled: vi.fn(async () => true),
    listLspFiles: h.listLspFiles,
    listLspSketchFiles: vi.fn(async () => []),
    sendLspMessage: vi.fn(async () => undefined),
    startLSP: vi.fn(async () => undefined),
    stopAllLSP: vi.fn(async () => undefined),
  }),
);

vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    dismissSnackbar: vi.fn(),
    snackbar: vi.fn(),
    useI18n: (): { formatMessage: (message: { id: string }) => string } => ({
      formatMessage: (message: { id: string }): string => message.id,
    }),
  }),
);

const makeWorkspace = (): Record<
  | 'createNodeFile'
  | 'createNodeFiles'
  | 'deleteNodeFile'
  | 'deleteNodeFolder'
  | 'renameOrMoveNodeFile'
  | 'renameOrMoveNodeFolder'
  | 'containsUri'
  | 'isTracked',
  ReturnType<typeof vi.fn>
> => ({
  isTracked: vi.fn(() => false),
  createNodeFile: vi.fn(),
  createNodeFiles: vi.fn(),
  deleteNodeFile: vi.fn(),
  deleteNodeFolder: vi.fn(),
  renameOrMoveNodeFile: vi.fn(),
  renameOrMoveNodeFolder: vi.fn(),
  containsUri: vi.fn(
    (path: string, uri: string) =>
      uri === `file://${TEMP_WORKSPACE}/${path}` ||
      uri.startsWith(`file://${TEMP_WORKSPACE}/${path}/`),
  ),
});

type FakeWorkspace = ReturnType<typeof makeWorkspace>;

const renderUseLSP = async (): Promise<{
  result: { current: ReturnType<typeof useLSP> };
  workspaces: Record<'python' | 'arduino', FakeWorkspace>;
  queryClient: QueryClient;
}> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const contextValue = {
    lspState: {},
    setLspStates: vi.fn(),
    resetLspState: vi.fn(),
  } as unknown as ContextType<typeof LanguageServerContext>;
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        LanguageServerContext.Provider,
        { value: contextValue },
        children,
      ),
    );

  const { result } = renderHook(() => useLSP('app-1'), { wrapper });
  await waitFor(() =>
    expect(result.current.lspWorkspaceDir).toBe(TEMP_WORKSPACE),
  );

  const workspaces = { python: makeWorkspace(), arduino: makeWorkspace() };
  (Object.keys(workspaces) as ('python' | 'arduino')[]).forEach((lspId) =>
    result.current.lspClients?.set(
      lspId as LspId,
      {
        client: {
          workspace: workspaces[lspId] as unknown as LspClientWorkspace,
          disconnect: vi.fn(),
        },
        transportDestroy: vi.fn(),
      } as unknown as LspClientRef,
    ),
  );
  return { result, workspaces, queryClient };
};

beforeEach(() => {
  h.listLspFiles.mockReset();
  h.listLspFiles.mockResolvedValue([]);
  useLspReferencesStore.getState().close();
});

describe('LSP workspace init', () => {
  // The init deletes and recopies the workspace under the running servers.
  it('runs once when the app detail refetches with the same path', async () => {
    vi.mocked(initLspWorkspace).mockClear();
    const { queryClient } = await renderUseLSP();
    await waitFor(() => expect(initLspWorkspace).toHaveBeenCalledTimes(1));

    vi.mocked(getAppDetail).mockResolvedValueOnce({
      path: '/home/arduino/ArduinoApps/app',
      name: 'renamed in app.yaml',
    } as Awaited<ReturnType<typeof getAppDetail>>);
    await act(() =>
      queryClient.refetchQueries({ queryKey: ['list-my-apps', 'app-1'] }),
    );
    // Lets the effect run and the mutation call through.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(initLspWorkspace).toHaveBeenCalledTimes(1);
  });
});

describe('renameLspNode', () => {
  it('moves the tracked files of a folder at once, then announces the listed ones', async () => {
    h.listLspFiles.mockResolvedValue(['lib/mod.py']);
    const { result, workspaces } = await renderUseLSP();

    act(() => result.current.renameLspNode?.('pkg', 'lib', 'folder'));

    expect(workspaces.python.renameOrMoveNodeFolder).toHaveBeenCalledWith(
      'pkg',
      'lib',
    );
    await waitFor(() =>
      expect(workspaces.python.createNodeFiles).toHaveBeenCalledWith([
        'lib/mod.py',
      ]),
    );
    expect(h.listLspFiles).toHaveBeenCalledWith(TEMP_WORKSPACE, 'lib');
  });

  it('moves a file to the server of its new extension', async () => {
    const { result, workspaces } = await renderUseLSP();

    act(() => result.current.renameLspNode?.('notes.txt', 'notes.py'));

    expect(workspaces.python.createNodeFile).toHaveBeenCalledWith('notes.py');
    expect(workspaces.python.renameOrMoveNodeFile).not.toHaveBeenCalled();
  });

  it('closes a references result that names the renamed file', async () => {
    const { result } = await renderUseLSP();
    useLspReferencesStore.getState().show({
      lspId: 'python',
      groups: [{ fileUri: `file://${TEMP_WORKSPACE}/util.py` }],
    } as unknown as LspReferencesResult);

    act(() => result.current.renameLspNode?.('main.py', 'start.py'));
    expect(useLspReferencesStore.getState().result).not.toBeNull();

    act(() => result.current.renameLspNode?.('util.py', 'helpers.py'));
    expect(useLspReferencesStore.getState().result).toBeNull();
  });
});

describe('syncLspWatchedChange', () => {
  it('announces the listed files of a folder that appeared', async () => {
    h.listLspFiles.mockResolvedValue(['pkg/a.py', 'pkg/b.py']);
    const { result, workspaces } = await renderUseLSP();

    act(() => result.current.syncLspWatchedChange?.('pkg', 'create'));

    expect(workspaces.python.createNodeFile).toHaveBeenCalledWith('pkg');
    expect(workspaces.arduino.createNodeFile).toHaveBeenCalledWith('pkg');
    await waitFor(() =>
      expect(workspaces.python.createNodeFiles).toHaveBeenCalledWith([
        'pkg/a.py',
        'pkg/b.py',
      ]),
    );
  });

  it('does not list a created file', async () => {
    const { result, workspaces } = await renderUseLSP();

    act(() => result.current.syncLspWatchedChange?.('main.py', 'create'));

    expect(workspaces.python.createNodeFile).toHaveBeenCalledWith('main.py');
    expect(h.listLspFiles).not.toHaveBeenCalled();
  });

  it('does not announce a create of a file a server already has open', async () => {
    const { result, workspaces } = await renderUseLSP();
    workspaces.arduino.isTracked.mockImplementation(
      (path: string) => path === 'sketch/helper.h',
    );

    act(() =>
      result.current.syncLspWatchedChange?.('sketch/helper.h', 'create'),
    );

    expect(workspaces.arduino.createNodeFile).not.toHaveBeenCalled();
    expect(workspaces.python.createNodeFile).toHaveBeenCalledWith(
      'sketch/helper.h',
    );
  });

  it('removes a path once from every server', async () => {
    const { result, workspaces } = await renderUseLSP();

    act(() => result.current.syncLspWatchedChange?.('pkg', 'remove'));

    expect(workspaces.python.deleteNodeFolder).toHaveBeenCalledWith('pkg');
    expect(workspaces.arduino.deleteNodeFolder).toHaveBeenCalledWith('pkg');
    expect(workspaces.python.deleteNodeFile).not.toHaveBeenCalled();
  });
});
