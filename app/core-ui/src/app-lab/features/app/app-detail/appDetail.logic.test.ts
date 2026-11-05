/**
 * The file-tree handlers' conflict guard. `WriteFileContent` truncates and
 * `RenameFile` is read + write + remove, so this check is the only thing
 * standing between an existing file and being overwritten: when it cannot be
 * resolved the operation must not go ahead.
 *
 * Everything the logic hook composes is stubbed; only its own handlers run.
 */

import type {
  AppsSection,
  Board,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createContext, createElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardScopedQuery } from '../../../boardScopedQuery';
import {
  isAgentFileRenameHandled,
  stashAppFileToOpen,
} from '../../../openAppFile';
import { useBoardLifecycleStore } from '../../../store/boardLifecycle';
import {
  SKETCH_INO_TEMPLATE,
  SKETCH_YAML_TEMPLATE,
} from '../../../utils/sketch-file-templates';
import { useAppDetailLogic } from './appDetail.logic';

// Every stub is created once: a new identity per render would restart the
// hook's effects and spin.
const h = vi.hoisted(() => ({
  // Wraps a value as a module factory / hook stub with an explicit return type.
  stub:
    <T>(value: T) =>
    (): T =>
      value,
  statAppPath: vi.fn(),
  getAppBricks: vi.fn((): Promise<never[]> => Promise.resolve([])),
  sendAppLabNotification: vi.fn(),
  onAgentRenamedAppFile: vi.fn(
    (
      _cb: (
        appId: string,
        appPath: string,
        from: string,
        to: string,
        isFolder: boolean,
      ) => void,
    ) => vi.fn(),
  ),
  findFileNode: vi.fn<(path: string) => unknown>(() => undefined),
  appFiles: {
    fileTree: [],
    appDirListed: true,
    appDirFailed: false,
    expandDir: vi.fn(),
    collapseDir: vi.fn(),
    revealPath: vi.fn(),
    findFileNode: (): undefined => undefined,
    invalidateDirs: vi.fn(),
    unlistDir: vi.fn(),
    renameDir: vi.fn(),
    refetchAppYaml: vi.fn(),
    refetchSketchYaml: vi.fn(),
    fetchFile: vi.fn((_path: string): Promise<void> => Promise.resolve()),
    refreshFileContents: vi.fn(),
  },
  editorFiles: {
    unsavedFileIds: [],
    editorFiles: [],
    openFiles: [],
    openFileIds: [],
    selectedFile: undefined as
      | { fileId: string; fileExtension: string }
      | undefined,
    selectFile: vi.fn(),
    updateOpenFile: vi.fn(),
    updateOpenFilesOrder: vi.fn(),
    closeFile: vi.fn(),
    onAppRename: vi.fn(),
    openFilesStore: {},
    tabsHydrated: true,
    storeSplitState: vi.fn(),
  },
  // The arguments of the last `useEditorFiles` call.
  editorFilesArgs: [] as unknown[],
  lsp: { lspClients: [], syncLspWatchedChange: vi.fn() },
  editorPanel: { rightPanelTabs: [], closeRightPanelTab: vi.fn() },
  // The arguments of the last `useCreateEditorPanelLogic` call.
  editorPanelArgs: [] as unknown[],
  runtime: { runtimeActionsLogic: (): Record<string, never> => ({}) },
  // The arguments of the last `useAppDetailRuntimeLogic` call.
  runtimeArgs: [] as unknown[],
  updateAppBrick: vi.fn(),
  updateAppDetail: vi.fn(),
  getAppDetail: vi.fn(),
  sketchLibraryDialog: { openDialog: vi.fn(), dialogLogic: vi.fn() },
  titleLogic: (): { onAppAction: () => void } => ({ onAppAction: vi.fn() }),
  brickDetailLogic: vi.fn(),
  importDialogLogic: vi.fn(),
  fileOperations: {
    renameFile: vi.fn(() => Promise.resolve()),
    deleteFile: vi.fn(),
    removeFolder: vi.fn(),
    addFile: vi.fn(() => Promise.resolve()),
    addFolder: vi.fn(() => Promise.resolve()),
    openFile: vi.fn(),
  },
  queryClient: { invalidateQueries: vi.fn() },
  activeSelectedFile: { fileId: 'python/sub/x.py', fileExtension: 'py' },
}));

const APP = { id: 'app-1', path: '/apps/foo', name: 'foo' };
// Reassigned by the test covering an app whose path never resolved.
let appPath: string | undefined = APP.path;

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  (): Record<string, unknown> => ({
    statAppPath: h.statAppPath,
    listAppDirectory: vi.fn((): Promise<never[]> => Promise.resolve([])),
    getAppDetail: h.getAppDetail.mockImplementation(
      (): Promise<Omit<typeof APP, 'path'> & { path?: string }> =>
        Promise.resolve({ ...APP, path: appPath }),
    ),
    getAppBricks: h.getAppBricks,
    getBricks: (): Promise<never[]> => Promise.resolve([]),
    getUnsavedFilesSubject: h.stub({ subscribe: vi.fn() }),
    addAppBrick: vi.fn(),
    addAppCustomBrick: vi.fn(),
    deleteAppBrick: vi.fn(),
    importResourceToAppFromPath: vi.fn(),
    onAgentRenamedApp: (): VoidFunction => vi.fn(),
    onAgentRenamedAppFile: h.onAgentRenamedAppFile,
    openFileExternal: vi.fn(),
    openLinkExternal: vi.fn(),
    renameAppCustomBrick: vi.fn(),
    selectResourcePathToImport: vi.fn(),
    updateAppBrick: h.updateAppBrick,
    updateAppDetail: h.updateAppDetail,
  }),
);

vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  async (importOriginal): Promise<Record<string, unknown>> => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useI18n: h.stub({ formatMessage: (m: { id: string }): string => m.id }),
  }),
);

vi.mock(
  '@cloud-editor-mono/images/assets/file-icons',
  h.stub({ FileIcon: (): null => null }),
);

// Flipped by the ⌘L tests: main keeps this route mounted (hidden) while Agent Mode is on screen.
let agentModeActive = false;

vi.mock(
  '@tanstack/react-router',
  h.stub({
    useNavigate: h.stub(vi.fn()),
    // All the logic asks the router is whether Agent Mode is the surface on screen.
    useRouterState: (): boolean => agentModeActive,
    useRouter: h.stub({ state: { location: { pathname: '/my-apps/app-1' } } }),
  }),
);

vi.mock(
  '../../notifications',
  h.stub({ sendAppLabNotification: h.sendAppLabNotification }),
);

// `findFileNode` closes over the listings, so the real hook hands back a new
// identity every time a folder is listed or refetched. Reproduced here.
vi.mock(
  './hooks/useAppFiles',
  h.stub({
    MAIN_SKETCH_PATH: 'sketch/sketch.ino',
    SKETCH_YAML_PATH: 'sketch/sketch.yaml',
    useAppFiles: (): Record<string, unknown> => ({
      ...h.appFiles,
      findFileNode: (path: string): unknown => h.findFileNode(path),
    }),
  }),
);

vi.mock(
  './hooks/useFileOperations',
  h.stub({
    useFileOperations: h.stub(h.fileOperations),
    keepMovedBuffer: (): boolean => false,
  }),
);

vi.mock(
  './hooks/useEditorFiles',
  h.stub({
    useEditorFiles: (...args: unknown[]): typeof h.editorFiles => {
      h.editorFilesArgs = args;
      return h.editorFiles;
    },
  }),
);

vi.mock('./hooks/useLSP', h.stub({ useLSP: h.stub(h.lsp) }));
vi.mock('./hooks/useFileWatch', h.stub({ useFileWatch: vi.fn() }));
vi.mock(
  './hooks/useSketchLibraries',
  h.stub({ useSketchLibraries: h.stub({}) }),
);
vi.mock(
  './hooks/useSketchLibrariesDialogs',
  h.stub({ useAddSketchLibraryDialog: h.stub(h.sketchLibraryDialog) }),
);
vi.mock(
  './sub-components/editor-panel/appLabEditorPanel',
  h.stub({
    useCreateEditorPanelLogic: (...args: unknown[]): typeof h.editorPanel => {
      h.editorPanelArgs = args;
      return h.editorPanel;
    },
  }),
);
vi.mock(
  './sub-components/runtime/appDetailRuntime',
  h.stub({
    useAppDetailRuntimeLogic: (...args: unknown[]): typeof h.runtime => {
      h.runtimeArgs = args;
      return h.runtime;
    },
  }),
);
vi.mock(
  './sub-components/title/appDetailTitle',
  h.stub({ useCreateAppTitleLogic: h.stub(h.titleLogic) }),
);
vi.mock('../../../hooks/useIsBoard', h.stub({ useIsBoard: h.stub({}) }));
vi.mock('../../../hooks/useNotFound', h.stub({ useNotFound: vi.fn() }));
vi.mock(
  '../../../hooks/useBrickDetail',
  h.stub({
    makeAppBrickDetailLogic: h.stub(h.brickDetailLogic),
    useConfigureAppBrickDialog: vi.fn(),
  }),
);
vi.mock(
  '../../../hooks/useImportResource',
  h.stub({ useImportResource: h.stub(h.importDialogLogic) }),
);
vi.mock(
  '../../../utils/create-webui-files',
  h.stub({ createWebUIFiles: vi.fn() }),
);
vi.mock('../../../../common/hooks/keywords', h.stub({ useKeywords: vi.fn() }));
// Built inside the factory, not around it: a mock factory runs before the
// file's own imports are initialised, so `createContext` is not there yet.
vi.mock(
  '../../../providers/language-server/languageServerContext',
  (): Record<string, unknown> => ({
    LanguageServerContext: createContext({
      activeSelectedFile: h.activeSelectedFile,
      setActiveSelectedFile: vi.fn(),
    }),
  }),
);
// The route tree drags in the whole app (auth included); only one map is used.
vi.mock(
  '../../../routes/__root',
  h.stub({
    DETAIL_PATH_BY_SECTION: { 'my-apps': '/my-apps', examples: '/examples' },
  }),
);
vi.mock(
  '../../../../common/providers/data-fetching/QueryProvider',
  h.stub({ queryClient: h.queryClient }),
);

type Handlers = {
  addFileHandler: (path: string) => Promise<void>;
  addFolderHandler: (path: string) => Promise<void>;
  renameFileHandler: (
    path: string,
    newName: string,
    appendExt?: boolean,
    nodeType?: 'file' | 'folder',
  ) => Promise<void>;
  renameAppCustomBrick: (
    brickId: string,
    params: { name: string },
  ) => Promise<boolean>;
  addAppCustomBrick: (
    appId: string,
    body: { name: string },
  ) => Promise<{ id: string } | undefined>;
};

const renderHandlers = async (): Promise<Handlers> => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { result } = renderHook(
    () =>
      useAppDetailLogic('app-1', 'my-apps').appLabEditSectionLogic() as unknown,
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    },
  );

  await waitFor(() =>
    expect((result.current as { app?: unknown }).app).toBeDefined(),
  );
  return result.current as Handlers;
};

const errorNotifications = (): unknown[] =>
  h.sendAppLabNotification.mock.calls.filter(
    ([params]) => params.variant === 'error',
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.findFileNode.mockReturnValue(undefined);
  appPath = APP.path;
  agentModeActive = false;
  h.statAppPath.mockRejectedValue(new Error('board unreachable'));
});

describe('appDetail.logic file reveal', () => {
  // Revealing expands the selected file's ancestors, so re-revealing re-adds a
  // folder the user has since collapsed. It belongs to the selection changing,
  // not to every listing: the effect that also reads `findFileNode` used to run
  // it, and that runs again after each watcher refetch.
  it('reveals the selected file once, whatever the listings do', async () => {
    await renderHandlers();

    expect(h.appFiles.revealPath).toHaveBeenCalledTimes(1);
    expect(h.appFiles.revealPath).toHaveBeenCalledWith('python/sub/x.py');
  });
});

// A file chip for the app on screen navigates to the route the user is already on, which remounts nothing.
describe('appDetail.logic file chip', () => {
  it('opens the file of the app already on screen, each time it is asked', async () => {
    h.findFileNode.mockReturnValue({});
    await renderHandlers();

    act(() => stashAppFileToOpen('app-1', 'python/main.py'));
    await waitFor(() =>
      expect(h.fileOperations.openFile).toHaveBeenCalledWith('python/main.py'),
    );

    act(() => stashAppFileToOpen('app-1', 'python/main.py'));
    await waitFor(() =>
      expect(h.fileOperations.openFile).toHaveBeenCalledTimes(2),
    );
  });

  // On a cold editor the stored tabs land after the tree; the file opens once they are in place.
  it('waits for the editor to put its tabs in place before it opens the file', async () => {
    h.findFileNode.mockReturnValue({});
    h.editorFiles.tabsHydrated = false;
    try {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { result, rerender } = renderHook(
        () => useAppDetailLogic('app-1', 'my-apps'),
        {
          wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
        },
      );
      await waitFor(() => expect(result.current.app).toBeDefined());

      act(() => stashAppFileToOpen('app-1', 'python/main.py'));
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(h.fileOperations.openFile).not.toHaveBeenCalled();

      h.editorFiles.tabsHydrated = true;
      rerender();
      await waitFor(() =>
        expect(h.fileOperations.openFile).toHaveBeenCalledWith(
          'python/main.py',
        ),
      );
    } finally {
      h.editorFiles.tabsHydrated = true;
    }
  });
});

describe('appDetail.logic conflict check', () => {
  it('does not create a file when the check fails', async () => {
    const { addFileHandler } = await renderHandlers();

    await addFileHandler('python/new.py');

    expect(h.fileOperations.addFile).not.toHaveBeenCalled();
    expect(errorNotifications()).toHaveLength(1);
  });

  it('does not create a folder when the check fails', async () => {
    const { addFolderHandler } = await renderHandlers();

    await addFolderHandler('python/lib');

    expect(h.fileOperations.addFolder).not.toHaveBeenCalled();
    expect(errorNotifications()).toHaveLength(1);
  });

  it('does not rename when the check fails', async () => {
    const { renameFileHandler } = await renderHandlers();

    await renameFileHandler('python/old.py', 'new.py', false, 'file');

    expect(h.fileOperations.renameFile).not.toHaveBeenCalled();
    expect(errorNotifications()).toHaveLength(1);
  });

  // Without a path there is nothing to stat, and the write would land on
  // `/<relative path>` on the host.
  it('does not create a file when the app has no path', async () => {
    appPath = undefined;
    h.statAppPath.mockResolvedValue(null);
    const { addFileHandler } = await renderHandlers();

    await addFileHandler('python/new.py');

    expect(h.statAppPath).not.toHaveBeenCalled();
    expect(h.fileOperations.addFile).not.toHaveBeenCalled();
    expect(errorNotifications()).toHaveLength(1);
  });

  it('creates the file when the check says the name is free', async () => {
    h.statAppPath.mockResolvedValue(null);
    const { addFileHandler } = await renderHandlers();

    await addFileHandler('python/new.py');

    expect(h.fileOperations.addFile).toHaveBeenCalled();
  });
});

describe('appDetail.logic sketch files created by hand', () => {
  // The stub is declared without parameters, so its calls are typed empty.
  const written = (): Array<[string, string | undefined]> =>
    (h.fileOperations.addFile.mock.calls as unknown as string[][]).map(
      ([path, , , content]) => [path, content],
    );

  beforeEach(() => {
    h.statAppPath.mockResolvedValue(null);
  });

  it('writes the sketch.yaml template into a sketch.yaml in any folder', async () => {
    const { addFileHandler } = await renderHandlers();

    await addFileHandler('python/sketch.yaml');

    expect(written()).toEqual([['python/sketch.yaml', SKETCH_YAML_TEMPLATE]]);
  });

  it('writes the sketch.ino template and also creates sketch/sketch.yaml when sketch/sketch.ino is created', async () => {
    const { addFileHandler } = await renderHandlers();

    await addFileHandler('sketch/sketch.ino');

    expect(written()).toEqual([
      ['sketch/sketch.ino', SKETCH_INO_TEMPLATE],
      ['sketch/sketch.yaml', SKETCH_YAML_TEMPLATE],
    ]);
    expect(errorNotifications()).toHaveLength(0);
  });

  it('writes any other name empty', async () => {
    const { addFileHandler } = await renderHandlers();

    await addFileHandler('python/new.py');

    expect(written()).toEqual([['python/new.py', '']]);
  });
});

// A tab id that is not in the brick list is shown as a file without an
// extension, so the brick tab must not get the new id before the list has it.
// Holds the next brick list request open and returns its resolver.
const holdNextBrickList = (): (() => void) => {
  let release: () => void = () => undefined;
  h.getAppBricks.mockReturnValueOnce(
    new Promise<never[]>((resolve) => {
      release = (): void => resolve([]);
    }),
  );
  return () => release();
};

describe('appDetail.logic add custom brick', () => {
  it('opens the brick tab only once the brick list has the new brick', async () => {
    vi.mocked(
      (
        await import(
          '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
        )
      ).addAppCustomBrick,
    ).mockResolvedValue({ id: 'new_brick_id' });
    const { addAppCustomBrick } = await renderHandlers();
    const listRequests = h.getAppBricks.mock.calls.length;
    const releaseBrickList = holdNextBrickList();

    const adding = addAppCustomBrick('app-1', { name: 'New Brick Id' });
    await waitFor(() =>
      expect(h.getAppBricks).toHaveBeenCalledTimes(listRequests + 1),
    );
    expect(h.editorFiles.selectFile).not.toHaveBeenCalled();

    releaseBrickList();
    await adding;
    expect(h.editorFiles.selectFile).toHaveBeenCalledWith({
      fileId: 'new_brick_id',
    });
  });
});

describe('appDetail.logic rename custom brick', () => {
  const mockRename = async (result: string | null): Promise<void> => {
    vi.mocked(
      (
        await import(
          '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
        )
      ).renameAppCustomBrick,
    ).mockResolvedValue(result);
  };

  it('renames the brick tab only once the brick list has the new id', async () => {
    await mockRename('new_brick_id');
    const { renameAppCustomBrick } = await renderHandlers();
    const listRequests = h.getAppBricks.mock.calls.length;
    const releaseBrickList = holdNextBrickList();

    const renaming = renameAppCustomBrick('old_brick_id', {
      name: 'New Brick Id',
    });
    await waitFor(() =>
      expect(h.getAppBricks).toHaveBeenCalledTimes(listRequests + 1),
    );
    expect(h.fileOperations.renameFile).toHaveBeenCalled();
    expect(h.editorFiles.updateOpenFile).not.toHaveBeenCalled();

    releaseBrickList();
    await renaming;
    expect(h.editorFiles.updateOpenFile).toHaveBeenCalledWith(
      'old_brick_id',
      'new_brick_id',
    );
  });

  it('renames the brick folder by its path and the brick tab by its id', async () => {
    await mockRename('new_brick_id');
    const { renameAppCustomBrick } = await renderHandlers();

    await renameAppCustomBrick('old_brick_id', { name: 'New Brick Id' });

    expect(h.fileOperations.renameFile).toHaveBeenCalledWith(
      'bricks/old_brick_id',
      'bricks/new_brick_id',
      { nodeType: 'folder', source: 'stream' },
    );
    expect(h.editorFiles.updateOpenFile).toHaveBeenCalledWith(
      'old_brick_id',
      'new_brick_id',
    );
    expect(h.appFiles.invalidateDirs).not.toHaveBeenCalled();
  });

  it('renames nothing when the rename fails', async () => {
    await mockRename(null);
    const { renameAppCustomBrick } = await renderHandlers();

    await renameAppCustomBrick('old_brick_id', { name: 'New Brick Id' });

    expect(h.fileOperations.renameFile).not.toHaveBeenCalled();
    expect(h.editorFiles.updateOpenFile).not.toHaveBeenCalled();
    expect(errorNotifications()).toHaveLength(1);
  });
});

// The agent's rename already happened on the board, so the tabs follow it without a second backend call.
describe('appDetail.logic agent file rename', () => {
  it("moves this app's tabs and ignores another app's", async () => {
    await renderHandlers();
    const onRenamed = h.onAgentRenamedAppFile.mock.calls.at(-1)?.[0];

    act(() => {
      onRenamed?.('app-1', '/apps/foo', 'capito', 'ok', true);
      onRenamed?.('app-2', '/apps/bar', 'x.py', 'y.py', false);
    });

    expect(h.fileOperations.renameFile).toHaveBeenCalledTimes(1);
    expect(h.fileOperations.renameFile).toHaveBeenCalledWith('capito', 'ok', {
      source: 'stream',
      nodeType: 'folder',
    });
    expect(h.lsp.syncLspWatchedChange.mock.calls).toEqual([
      ['capito', 'remove'],
      ['ok', 'create'],
    ]);
  });

  // The tree keeps its own open state by path, and main.logic moves the stored tabs only when no editor does.
  it('reopens a renamed folder, and tells main.logic it moves the tabs while mounted', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result, unmount } = renderHook(
      () =>
        useAppDetailLogic('app-1', 'my-apps').appLabEditSectionLogic() as {
          app?: unknown;
          renamedFolder?: unknown;
        },
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );
    await waitFor(() => expect(result.current.app).toBeDefined());
    expect(isAgentFileRenameHandled('/apps/foo')).toBe(true);

    act(() => {
      h.onAgentRenamedAppFile.mock.calls.at(-1)?.[0](
        'app-1',
        '/apps/foo',
        'capito',
        'ok',
        true,
      );
    });

    expect(result.current.renamedFolder).toEqual({
      from: 'capito',
      to: 'ok',
      seq: 1,
    });
    unmount();
    expect(isAgentFileRenameHandled('/apps/foo')).toBe(false);
  });
});

// The tree's onFileRename resolves whatever happened, so the tree reopens a renamed folder only on renamedFolder.
describe('appDetail.logic folder rename from the tree', () => {
  type EditSection = Pick<Handlers, 'renameFileHandler'> & {
    app?: unknown;
    renamedFolder?: unknown;
  };

  const renderLogic = async (): Promise<{ current: EditSection }> => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () =>
        useAppDetailLogic(
          'app-1',
          'my-apps',
        ).appLabEditSectionLogic() as unknown as EditSection,
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );
    await waitFor(() => expect(result.current.app).toBeDefined());
    return result;
  };

  it('reports a folder the board renamed', async () => {
    h.statAppPath.mockResolvedValue(null);
    const result = await renderLogic();

    await act(() =>
      result.current.renameFileHandler('python/lib', 'utils', false, 'folder'),
    );

    expect(result.current.renamedFolder).toEqual({
      from: 'python/lib',
      to: 'python/utils',
      seq: 1,
    });
  });

  it.each([
    ['the name is taken', { isDir: true }, false],
    ['the board refuses it', null, true],
  ])('reports no folder when %s', async (_, existing, renameFails) => {
    h.statAppPath.mockResolvedValue(existing);
    if (renameFails) {
      h.fileOperations.renameFile.mockRejectedValueOnce(new Error('busy'));
    }
    const result = await renderLogic();

    await act(() =>
      result.current.renameFileHandler('python/lib', 'utils', false, 'folder'),
    );

    expect(result.current.renamedFolder).toBeUndefined();
    expect(errorNotifications()).toHaveLength(1);
  });
});

// ⌘L lives here rather than in EditorPanel: the shortcut is window-wide, and main keeps this route
// mounted (hidden) in Agent Mode, where a listener of its own toggled an invisible panel and ate the key.
describe('appDetail.logic agent panel shortcut', () => {
  const renderLogic = async (
    section: AppsSection = 'my-apps',
  ): Promise<{ current: ReturnType<typeof useAppDetailLogic> }> => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useAppDetailLogic('app-1', section), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    });
    await waitFor(() => expect(result.current.app).toBeDefined());
    return result;
  };

  const pressCmdL = (): void => {
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'l', metaKey: true }),
      );
    });
  };

  it('toggles the panel from the editor', async () => {
    const result = await renderLogic();
    expect(result.current.agentPanelVisible).toBe(false);

    pressCmdL();
    expect(result.current.agentPanelVisible).toBe(true);

    pressCmdL();
    expect(result.current.agentPanelVisible).toBe(false);
  });

  it('leaves the key alone while Agent Mode is on screen', async () => {
    agentModeActive = true;
    const result = await renderLogic();

    pressCmdL();

    expect(result.current.agentPanelVisible).toBe(false);
  });

  // Read-only example apps can't run the agent, so there is no panel for ⌘L to open.
  it('leaves the key alone on a read-only example app', async () => {
    const result = await renderLogic('examples');

    pressCmdL();

    expect(result.current.agentPanelVisible).toBe(false);
  });
});

describe('appDetail.logic updateAppBricks', () => {
  type UpdateAppBricks = (
    bricks: Record<string, { variables: Record<string, string> }>,
  ) => Promise<boolean>;

  // The daemon can lose a value when two PATCHes to the same app overlap.
  it('sends the next brick PATCH only after the previous one resolves', async () => {
    await renderHandlers();
    const updateAppBricks = h.runtimeArgs[5] as UpdateAppBricks;

    let resolveFirst: (ok: boolean) => void = () => undefined;
    h.updateAppBrick
      .mockImplementationOnce(
        () => new Promise<boolean>((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce(true);

    let done = false;
    const pending = updateAppBricks({
      'arduino:telegram_bot': { variables: { TELEGRAM_BOT_TOKEN: 't' } },
      'arduino:object_detection': { variables: {} },
    }).then((ok) => {
      done = true;
      return ok;
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(h.updateAppBrick).toHaveBeenCalledTimes(1);
    expect(h.updateAppBrick).toHaveBeenLastCalledWith(
      'app-1',
      'arduino:telegram_bot',
      { variables: { TELEGRAM_BOT_TOKEN: 't' } },
    );
    expect(done).toBe(false);

    resolveFirst(true);
    await expect(pending).resolves.toBe(true);
    expect(h.updateAppBrick).toHaveBeenCalledTimes(2);
    expect(h.updateAppBrick).toHaveBeenLastCalledWith(
      'app-1',
      'arduino:object_detection',
      { variables: {} },
    );
  });
});

describe('appDetail.logic updateApp', () => {
  type UpdateApp = (request: { default?: boolean }) => Promise<boolean>;

  // The My Apps list sections and the status list behind this toggle are other queries under the same prefix.
  it('refreshes every app list query after a "Run at startup" change', async () => {
    await renderHandlers();
    const updateApp = h.runtimeArgs[4] as UpdateApp;
    h.updateAppDetail.mockResolvedValue(APP.id);
    h.getAppDetail.mockClear();

    await act(async () => {
      await expect(updateApp({ default: true })).resolves.toBe(true);
    });

    expect(h.updateAppDetail).toHaveBeenCalledWith(APP.id, { default: true });
    expect(h.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [BoardScopedQuery.LIST_MY_APPS],
    });
    // The prefix invalidate already refetches this detail; a second fetch would be cancelled.
    expect(h.getAppDetail).not.toHaveBeenCalled();
  });
});

describe('appDetail.logic tab loads', () => {
  afterEach(() => {
    h.editorFiles.selectedFile = undefined;
  });

  // `cat` reaches a link to a sticky or setgid folder and answers with its own capital letter.
  it.each([
    'is a directory',
    'Process exited with status 1: cat: /home/arduino/ArduinoApps/a/lnk: Is a directory',
  ])('closes the tab of a folder and says why, for "%s"', async (answer) => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    h.editorFiles.selectedFile = { fileId: 'lnk', fileExtension: '' };
    h.appFiles.fetchFile.mockRejectedValueOnce(new Error(answer));
    try {
      await renderHandlers();

      await waitFor(() =>
        expect(h.editorFiles.closeFile).toHaveBeenCalledWith('lnk'),
      );
      expect(h.editorPanel.closeRightPanelTab).toHaveBeenCalledWith('lnk');
      expect(errorNotifications()).toEqual([
        [{ message: 'app-detail.could-not-open-folder', variant: 'error' }],
      ]);
    } finally {
      consoleError.mockRestore();
    }
  });

  // With the board unreachable every read fails: a close would select the next tab, fail it too, and store no tab at all.
  it('keeps the tab when its read fails for any other reason, and says so', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    h.editorFiles.selectedFile = {
      fileId: 'python/main.py',
      fileExtension: 'py',
    };
    h.appFiles.fetchFile.mockRejectedValueOnce(
      new Error('ssh: handshake failed: connection refused'),
    );
    try {
      await renderHandlers();

      await waitFor(() =>
        expect(errorNotifications()).toEqual([
          [{ message: 'app-detail.could-not-open-file', variant: 'error' }],
        ]),
      );
      expect(h.editorFiles.closeFile).not.toHaveBeenCalled();
      expect(h.editorPanel.closeRightPanelTab).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('reads no file for a brick tab', async () => {
    h.editorFiles.selectedFile = {
      fileId: 'arduino:web_ui',
      fileExtension: 'brick',
    };
    await renderHandlers();

    expect(h.appFiles.fetchFile).not.toHaveBeenCalled();
  });

  // Without the brick list a brick tab has a file's meta; the root listing has every file of the app root.
  it('reads no root tab the listing does not have while the brick list is missing', async () => {
    h.getAppBricks.mockRejectedValue(new Error('bricks failed'));
    h.findFileNode.mockImplementation((path: string) =>
      path === 'README.md'
        ? { type: 'file', path, name: path, extension: '.md' }
        : undefined,
    );
    try {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { result, rerender } = renderHook(
        () => useAppDetailLogic('app-1', 'my-apps'),
        {
          wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
        },
      );
      await waitFor(() => expect(result.current.app).toBeDefined());
      await waitFor(() => expect(h.getAppBricks).toHaveBeenCalled());
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

      h.editorFiles.selectedFile = {
        fileId: 'arduino:web_ui',
        fileExtension: '',
      };
      rerender();
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(h.appFiles.fetchFile).not.toHaveBeenCalled();

      h.editorFiles.selectedFile = { fileId: 'README.md', fileExtension: 'md' };
      rerender();

      await waitFor(() =>
        expect(h.appFiles.fetchFile).toHaveBeenCalledWith('README.md'),
      );
    } finally {
      h.getAppBricks.mockImplementation(
        (): Promise<never[]> => Promise.resolve([]),
      );
    }
  });

  // A board switch resets the brick list before the tabs, and a tab with no brick behind it reads as a file.
  it('reads no file when the selected brick tab loses its brick', async () => {
    h.editorFiles.selectedFile = {
      fileId: 'arduino:web_ui',
      fileExtension: 'brick',
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result, rerender } = renderHook(
      () => useAppDetailLogic('app-1', 'my-apps'),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );
    await waitFor(() => expect(result.current.app).toBeDefined());

    h.editorFiles.selectedFile = {
      fileId: 'arduino:web_ui',
      fileExtension: '',
    };
    rerender();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(h.appFiles.fetchFile).not.toHaveBeenCalled();
  });

  it('closes a panel B tab only when its path is a folder, and says so each time', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await renderHandlers();
      const [params] = h.editorPanelArgs as [
        { onFileLoadError?: (fileId: string, error: unknown) => void },
      ];

      act(() =>
        params.onFileLoadError?.('python/b.py', new Error('board unreachable')),
      );
      expect(h.editorPanel.closeRightPanelTab).not.toHaveBeenCalled();

      act(() =>
        params.onFileLoadError?.('python/b.py', new Error('is a directory')),
      );

      expect(h.editorPanel.closeRightPanelTab).toHaveBeenCalledWith(
        'python/b.py',
      );
      expect(errorNotifications()).toHaveLength(2);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('appDetail.logic board of the tabs', () => {
  afterEach(() => {
    useBoardLifecycleStore.setState({ selectedConnectedBoard: undefined });
  });

  // A board switch resets the board queries on this id, and a network board often reports no serial.
  it('restores and writes the tabs on the id the board queries are reset on', async () => {
    const board: Board = {
      id: 'board-1',
      name: 'UNO Q',
      type: 'Arduino Uno Q',
      fqbn: 'arduino:zephyr:unoq',
      connectionType: 'Network',
      protocol: 'network',
      serial: '',
      address: '192.168.1.10',
    };
    useBoardLifecycleStore.setState({ selectedConnectedBoard: board });

    await renderHandlers();

    expect(h.editorFilesArgs[0]).toMatchObject({ boardId: '192.168.1.10' });
  });
});
