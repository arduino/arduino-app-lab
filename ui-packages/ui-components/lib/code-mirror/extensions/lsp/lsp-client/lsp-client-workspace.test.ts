/**
 * Unit tests for LspClientWorkspace's server-document bookkeeping.
 *
 * `file.doc` is the workspace's record of what the server holds — every
 * didChange range is computed against it (syncFiles, refreshFile), so any
 * path that changes the editor content without keeping `file.doc` in step
 * silently desyncs all later edits. These tests pin the flows that move
 * content outside the normal typing path:
 *  - an in-place buffer reload (external change picked up by the file
 *    watcher) recreates the view state, so openFile() sees a tracked file
 *    whose incoming doc differs and must re-sync the server;
 *  - refreshFile() (external change to a file tracked but not shown in any
 *    editor) must do the same without a view;
 *  - closeFile() must flush edits still pending in the closing view's plugin
 *    (its destroy cancels the autoSync debounce that would have sent them);
 *  - createNodeFile() must track new files of the workspace's language so
 *    external changes and server-initiated edits treat them as first-class.
 *
 * Every didChange this workspace sends MUST carry a range: a rangeless
 * full-content change panics the Arduino LS ("full-text change not
 * implemented"). Restart recovery is handled backend-side by folding these
 * ranged changes into the replay snapshot (recordRecoveryStateFileChange in
 * lsp.go), not by client-side re-syncs.
 */

import { ChangeSet, Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import { FileChangeType } from 'vscode-languageserver-protocol';

import {
  LspDidChangeTextDocumentParams,
  LspDidChangeWatchedFilesParams,
  LspId,
} from '../lsp-types';
import { CustomLspClient } from './lsp-client-types';
import { LspClientWorkspace } from './lsp-client-workspace';

const WORKSPACE_URI = 'file:///ws';
const FILE_PATH = 'main.py';
const FILE_URI = `${WORKSPACE_URI}/${FILE_PATH}`;

// Minimal stand-in for an LSPPlugin: closeFile's flush reads `uri` and
// `unsyncedChanges`; getViews() treats a view whose plugin matches the file
// uri as live.
const makePlugin = (uri: string, unsyncedChanges: ChangeSet): unknown => ({
  uri,
  unsyncedChanges,
});

// Minimal stand-in for an EditorView: the workspace paths under test only
// read `state.doc` and resolve the plugin via `view.plugin()`. With the
// default null plugin, getViews() treats the view as not live.
const makeView = (content: string, plugin: unknown = null): EditorView =>
  ({
    state: { doc: Text.of(content.split('\n')) },
    plugin: () => plugin,
  } as unknown as EditorView);

const makeClient = (): CustomLspClient =>
  ({
    didOpen: vi.fn(),
    didClose: vi.fn(),
    notification: vi.fn(),
    getDiagnostics: vi.fn(() => undefined),
    deleteDiagnostics: vi.fn(),
  } as unknown as CustomLspClient);

const makeWorkspace = (
  lspId: LspId = 'python',
  getLspWorkspaceFile?: (fileUri: string) => Promise<string>,
  setFileValue?: (fileId: string, value: string) => boolean,
  openEditorFile: (fileUri: string) => void = () => undefined,
  ensureFileValue?: (fileId: string) => Promise<string | undefined>,
): { workspace: LspClientWorkspace; client: CustomLspClient } => {
  const client = makeClient();
  const workspace = new LspClientWorkspace(
    client,
    lspId,
    WORKSPACE_URI,
    openEditorFile,
    undefined,
    getLspWorkspaceFile,
    undefined,
    setFileValue,
    ensureFileValue,
  );
  return { workspace, client };
};

const notificationCalls = <T>(client: CustomLspClient, method: string): T[] =>
  (client.notification as ReturnType<typeof vi.fn>).mock.calls
    .filter(([calledMethod]) => calledMethod === method)
    .map(([, params]) => params as T);

const didChangeCalls = (
  client: CustomLspClient,
): LspDidChangeTextDocumentParams[] =>
  notificationCalls(client, 'textDocument/didChange');

const watchedFilesCalls = (
  client: CustomLspClient,
): LspDidChangeWatchedFilesParams[] =>
  notificationCalls(client, 'workspace/didChangeWatchedFiles');

describe('openFile', () => {
  it('registers and didOpens a new file', () => {
    const { workspace, client } = makeWorkspace();

    workspace.openFile(FILE_URI, 'py', makeView('a\nb'));

    expect(client.didOpen).toHaveBeenCalledTimes(1);
    const file = workspace.getFile(FILE_URI);
    expect(file?.doc.toString()).toBe('a\nb');
    expect(file?.version).toBe(1);
  });

  it('re-syncs a tracked file whose buffer was reloaded with different content', () => {
    const { workspace, client } = makeWorkspace();
    const originalView = makeView('one\ntwo\nthree');
    workspace.openFile(FILE_URI, 'py', originalView);

    // In-place reload: the hook replaces the editor state, destroying the
    // plugin (closeFile) and re-creating it (openFile) around the new doc.
    workspace.closeFile(FILE_URI, originalView);
    workspace.openFile(FILE_URI, 'py', makeView('x'));

    const [change] = didChangeCalls(client);
    expect(change.textDocument).toEqual({ uri: FILE_URI, version: 2 });
    // The replaced range must span the PREVIOUS doc (what the server holds),
    // not the incoming one.
    expect(change.contentChanges).toEqual([
      {
        text: 'x',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 2, character: 5 },
        },
      },
    ]);
    // file.doc is what later didChange ranges are computed against — it must
    // now match the reloaded content or every subsequent edit desyncs.
    expect(workspace.getFile(FILE_URI)?.doc.toString()).toBe('x');
    // Cached diagnostics are positioned against the replaced doc.
    expect(client.deleteDiagnostics).toHaveBeenCalledWith(FILE_URI);
  });

  it('sends only the differing span when a reload changes part of the doc', () => {
    const { workspace, client } = makeWorkspace('arduino');
    const view = makeView('line1\nline2\nline3');
    workspace.openFile(FILE_URI, 'ino', view);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.closeFile(FILE_URI, view);
    workspace.openFile(FILE_URI, 'ino', makeView('line1\nlineX\nline3'));

    // A minimal ranged edit keeps the Arduino LS on the same light
    // incremental path as typing; a whole-document replace would force a
    // full sketch rebuild + reindex.
    const [change] = didChangeCalls(client);
    expect(change.contentChanges).toEqual([
      {
        text: 'X',
        range: {
          start: { line: 1, character: 4 },
          end: { line: 1, character: 5 },
        },
      },
    ]);
    expect(workspace.getFile(FILE_URI)?.doc.toString()).toBe(
      'line1\nlineX\nline3',
    );
  });

  it('does not send a reconciling didChange when the reopened doc is unchanged (arduino)', () => {
    const { workspace, client } = makeWorkspace('arduino');
    const view = makeView('void setup() {}');
    workspace.openFile(FILE_URI, 'ino', view);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    // Plain tab switch: same content comes back.
    workspace.closeFile(FILE_URI, view);
    workspace.openFile(FILE_URI, 'ino', makeView('void setup() {}'));

    expect(didChangeCalls(client)).toHaveLength(0);
    expect(client.deleteDiagnostics).not.toHaveBeenCalled();
  });
});

describe('closeFile', () => {
  it('flushes edits still pending in the closing view', () => {
    const { workspace, client } = makeWorkspace();
    const doc = 'one two three';
    // Pending edit: "two" -> "XYZ", not yet synced (autoSync debounce).
    const plugin = makePlugin(
      FILE_URI,
      ChangeSet.of({ from: 4, to: 7, insert: 'XYZ' }, doc.length),
    );
    const view = makeView(doc, plugin);
    workspace.openFile(FILE_URI, 'py', view);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.closeFile(FILE_URI, view);

    const [change] = didChangeCalls(client);
    expect(change.textDocument).toEqual({ uri: FILE_URI, version: 2 });
    expect(change.contentChanges).toEqual([
      {
        text: 'XYZ',
        range: {
          start: { line: 0, character: 4 },
          end: { line: 0, character: 7 },
        },
      },
    ]);
    expect(workspace.getFile(FILE_URI)?.doc.toString()).toBe('one XYZ three');
  });

  it('does not flush while another pane still shows the file', () => {
    const { workspace, client } = makeWorkspace();
    const doc = 'a';
    const pendingChange = (): ChangeSet =>
      ChangeSet.of({ from: 0, to: 1, insert: 'b' }, doc.length);
    const viewA = makeView(doc, makePlugin(FILE_URI, pendingChange()));
    const viewB = makeView(doc, makePlugin(FILE_URI, pendingChange()));
    workspace.openFile(FILE_URI, 'py', viewA);
    workspace.openFile(FILE_URI, 'py', viewB);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    // Pane A closes; pane B's plugin still carries the same pending edit and
    // will sync it through the normal autoSync path.
    workspace.closeFile(FILE_URI, viewA);

    expect(didChangeCalls(client)).toHaveLength(0);
    expect(workspace.getFile(FILE_URI)?.doc.toString()).toBe('a');
  });
});

describe('createNodeFile', () => {
  it('announces the file on disk and tracks it from disk content', async () => {
    const getLspWorkspaceFile = vi.fn(async () => 'print(1)');
    const { workspace, client } = makeWorkspace('python', getLspWorkspaceFile);

    workspace.createNodeFile('utils.py');

    expect(watchedFilesCalls(client)[0].changes).toEqual([
      { uri: `${WORKSPACE_URI}/utils.py`, type: FileChangeType.Created },
    ]);

    await workspace.waitForPendingDiskOpen('utils.py');
    expect(client.didOpen).toHaveBeenCalledTimes(1);
    expect(workspace.isTracked('utils.py')).toBe(true);
    expect(workspace.getFile(`${WORKSPACE_URI}/utils.py`)?.doc.toString()).toBe(
      'print(1)',
    );
  });

  it('does not track folder paths or files of another language', async () => {
    const getLspWorkspaceFile = vi.fn(async () => 'x');
    const { workspace, client } = makeWorkspace('python', getLspWorkspaceFile);

    workspace.createNodeFile('myfolder');
    workspace.createNodeFile('sketch/main.ino');
    await workspace.waitForPendingDiskOpen('myfolder');
    await workspace.waitForPendingDiskOpen('sketch/main.ino');

    // Both still announced on disk (the server drops resolution caches)...
    expect(watchedFilesCalls(client)).toHaveLength(2);
    // ...but neither is opened as a document of this workspace.
    expect(getLspWorkspaceFile).not.toHaveBeenCalled();
    expect(client.didOpen).not.toHaveBeenCalled();
  });
});

describe('notifyWatchedFileChanged', () => {
  it('announces a disk content change for an untracked file', () => {
    const { workspace, client } = makeWorkspace();

    workspace.notifyWatchedFileChanged('lib/helper.py');

    expect(watchedFilesCalls(client)[0].changes).toEqual([
      { uri: `${WORKSPACE_URI}/lib/helper.py`, type: FileChangeType.Changed },
    ]);
  });
});

describe('resyncStaleDocument', () => {
  it('re-aligns a version-diverged doc with a rangeless full-content didChange', () => {
    const { workspace, client } = makeWorkspace();
    workspace.openFile(FILE_URI, 'py', makeView('current content'));
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.resyncStaleDocument(FILE_URI);

    const [change] = didChangeCalls(client);
    expect(change.textDocument).toEqual({ uri: FILE_URI, version: 2 });
    expect(change.contentChanges).toEqual([{ text: 'current content' }]);
  });

  it('fires at most once per client version', () => {
    const { workspace, client } = makeWorkspace();
    workspace.openFile(FILE_URI, 'py', makeView('x'));
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.resyncStaleDocument(FILE_URI);
    // Another stale publish arrives while the resync is in flight: no storm.
    workspace.resyncStaleDocument(FILE_URI);
    expect(didChangeCalls(client)).toHaveLength(1);

    // After the document moves on (new version), a fresh divergence may be
    // re-aligned again.
    workspace.refreshFile(FILE_PATH, 'moved on');
    workspace.resyncStaleDocument(FILE_URI);
    expect(didChangeCalls(client)).toHaveLength(3);
  });

  it('never sends the rangeless form to the Arduino LS (it panics on it)', () => {
    const { workspace, client } = makeWorkspace('arduino');
    workspace.openFile(FILE_URI, 'ino', makeView('void setup() {}'));
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.resyncStaleDocument(FILE_URI);

    expect(didChangeCalls(client)).toHaveLength(0);
  });
});

describe('external delete → recreate → edit sequence (newVars.py repro)', () => {
  it('delivers the edited content after a delete/recreate cycle', async () => {
    const disk = { content: "endpoint = 'X'\n" };
    const getLspWorkspaceFile = vi.fn(async () => disk.content);
    const { workspace, client } = makeWorkspace('python', getLspWorkspaceFile);

    // Healthy: tracked without a view (background/closed tab).
    workspace.openFile(FILE_URI, 'py', makeView("endpoint = 'X'\n"));
    workspace.closeFile(FILE_URI, makeView("endpoint = 'X'\n"));

    // rm from terminal: dir/remove → syncLspWatchedChange('remove').
    workspace.deleteNodeFolder(FILE_PATH);
    workspace.deleteNodeFile(FILE_PATH);
    expect(client.didClose).toHaveBeenCalledWith(FILE_URI);
    expect(workspace.isTracked(FILE_PATH)).toBe(false);

    // touch: dir/create → createNodeFile re-tracks from (empty) disk,
    // then the watcher's reloadLspFile no-ops on identical content.
    disk.content = '';
    workspace.createNodeFile(FILE_PATH);
    await workspace.waitForPendingDiskOpen(FILE_PATH);
    expect(workspace.isTracked(FILE_PATH)).toBe(true);
    expect(workspace.needsExternalReload(FILE_PATH)).toBe(true);
    workspace.refreshFile(FILE_PATH, '');
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    // edit from terminal: the watcher's reloadLspFile path must deliver the
    // new content as a didChange, or the server's empty didOpen'd buffer
    // masks the disk forever.
    disk.content = "endpoint = 'x'\n";
    workspace.createNodeFile(FILE_PATH); // dir/create half of an atomic save
    await workspace.waitForPendingDiskOpen(FILE_PATH);
    expect(workspace.needsExternalReload(FILE_PATH)).toBe(true);
    workspace.refreshFile(FILE_PATH, disk.content);

    const changes = didChangeCalls(client);
    expect(changes).toHaveLength(1);
    expect(changes[0].contentChanges).toEqual([
      {
        text: "endpoint = 'x'\n",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      },
    ]);
    expect(workspace.getFile(FILE_URI)?.doc.toString()).toBe(
      "endpoint = 'x'\n",
    );
  });
});

describe('CuziBug: arduino header delete → touch → re-paste', () => {
  it('delivers the re-pasted content to the arduino LS after the cycle', async () => {
    // rm utils.h → touch utils.h → nano re-paste. Pre-fix this wedged
    // permanently: the touch never re-tracked the file, so the paste's
    // external change had nothing to sync onto and clangd resolved the
    // include against the empty build copy until app restart.
    const HEADER = 'sketch/utils.h';
    const HEADER_URI = `${WORKSPACE_URI}/${HEADER}`;
    const disk = { content: 'inline void log_action() {}\n' };
    const getLspWorkspaceFile = vi.fn(async () => disk.content);
    const { workspace, client } = makeWorkspace('arduino', getLspWorkspaceFile);

    workspace.openFile(HEADER_URI, 'h', makeView(disk.content));
    workspace.closeFile(HEADER_URI, makeView(disk.content));

    // rm
    workspace.deleteNodeFolder(HEADER);
    workspace.deleteNodeFile(HEADER);
    expect(workspace.isTracked(HEADER)).toBe(false);

    // touch: dir/create re-tracks from the (empty) mirror
    disk.content = '';
    workspace.createNodeFile(HEADER);
    await workspace.waitForPendingDiskOpen(HEADER);
    expect(workspace.isTracked(HEADER)).toBe(true);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    // nano re-paste: file event → surgical sync
    disk.content = 'inline void log_action() {}\n';
    expect(workspace.needsExternalReload(HEADER)).toBe(true);
    workspace.refreshFile(HEADER, disk.content);

    const changes = didChangeCalls(client);
    expect(changes).toHaveLength(1);
    expect(changes[0].contentChanges).toEqual([
      {
        text: 'inline void log_action() {}\n',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      },
    ]);
    expect(workspace.getFile(HEADER_URI)?.doc.toString()).toBe(
      'inline void log_action() {}\n',
    );
  });
});

describe('refreshFile', () => {
  it('replaces the server copy of a tracked, not-shown file and updates file.doc', () => {
    const { workspace, client } = makeWorkspace();
    // Track the file; the fake view reports no live plugin, so the file
    // counts as not shown in any editor (getViews() is empty).
    workspace.openFile(FILE_URI, 'py', makeView('one\ntwo'));

    workspace.refreshFile(FILE_PATH, 'three');

    const [change] = didChangeCalls(client);
    expect(change.textDocument).toEqual({ uri: FILE_URI, version: 2 });
    expect(change.contentChanges).toEqual([
      {
        text: 'three',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 3 },
        },
      },
    ]);
    expect(workspace.getFile(FILE_URI)?.doc.toString()).toBe('three');
  });

  it('sends nothing when the disk content matches the tracked doc', () => {
    const { workspace, client } = makeWorkspace();
    workspace.openFile(FILE_URI, 'py', makeView('same'));
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.refreshFile(FILE_PATH, 'same');

    expect(didChangeCalls(client)).toHaveLength(0);
  });
});

/**
 * A cross-file rename edits files the user is not looking at. Dispatching those
 * edits into a view meant force-opening each one, and the edit was then routinely
 * undone: the editor's onChange writes to whichever file is *selected*, so an edit
 * dispatched into a just-opened pane raced React committing that selection — the
 * text went to the wrong key, the file's own content stayed stale, and the next
 * state rebuild reverted the document.
 */
describe('applyFileUpdate for a file with no view', () => {
  const OTHER_PATH = 'other.py';
  const OTHER_URI = `${WORKSPACE_URI}/${OTHER_PATH}`;

  // Tracked from disk, never shown in a pane — exactly the shape of the "other"
  // file in a cross-file rename.
  const trackViewlessFile = async (
    setFileValue?: (fileId: string, value: string) => boolean,
    openEditorFile: (fileUri: string) => void = () => undefined,
  ): Promise<{ workspace: LspClientWorkspace; client: CustomLspClient }> => {
    const { workspace, client } = makeWorkspace(
      'python',
      async () => 'bad = 1',
      setFileValue,
      openEditorFile,
    );
    workspace.createNodeFile(OTHER_PATH);
    await workspace.waitForPendingDiskOpen(OTHER_PATH);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();
    return { workspace, client };
  };

  it('writes through the content store instead of opening the file', async () => {
    const writes: [string, string][] = [];
    const opened: string[] = [];
    const { workspace } = await trackViewlessFile(
      (fileId, value) => {
        writes.push([fileId, value]);
        return true;
      },
      (uri) => opened.push(uri),
    );

    const applied = await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    expect(applied).toBe(true);
    // Keyed by the file's own workspace-relative id, not by the selection —
    // which is what made the edit land on the wrong file and get reverted.
    expect(writes).toEqual([[OTHER_PATH, 'badGood = 1']]);
    // And no navigation: the pane must not jump to the file being edited.
    expect(opened).toEqual([]);
  });

  it('keeps the server in step, since syncFiles() skips files without a view', async () => {
    const { workspace, client } = await trackViewlessFile(() => true);

    await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    const changes = didChangeCalls(client);
    expect(changes).toHaveLength(1);
    expect(changes[0].textDocument.uri).toBe(OTHER_URI);
    // file.doc is what every later didChange range is computed against.
    expect(workspace.getFile(OTHER_URI)?.doc.toString()).toBe('badGood = 1');
  });

  it('falls back to opening the file when no store writer is wired up', async () => {
    const opened: string[] = [];
    const { workspace } = await trackViewlessFile(undefined, (uri) =>
      opened.push(uri),
    );

    // No view ever appears, so displayFile gives up and the edit is reported as
    // not applied — but it must have tried, rather than silently skipping.
    const applied = await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    expect(applied).toBe(false);
    expect(opened).toEqual([OTHER_URI]);
  }, 10_000);
});

/**
 * The store creates a file's content subject lazily on first open, so a header
 * that has never been opened this session has nowhere to write. An earlier version
 * advanced the server *before* the write and reported success regardless, which
 * meant a cross-file rename silently dropped that file's edit while moving the
 * server and `file.doc` to the renamed text — and the next rename, computed against
 * the server's copy but applied to the stale real content, spliced the two together
 * ("DAVEA" + "DAVE" -> "DAVEADAVE").
 */
describe('applyFileUpdate for a file with no content subject yet', () => {
  const OTHER_PATH = 'other.py';
  const OTHER_URI = `${WORKSPACE_URI}/${OTHER_PATH}`;
  const DISK = 'bad = 1';

  const trackViewlessFile = async (
    setFileValue: (fileId: string, value: string) => boolean,
    ensureFileValue?: (fileId: string) => Promise<string | undefined>,
    openEditorFile: (fileUri: string) => void = () => undefined,
  ): Promise<{ workspace: LspClientWorkspace; client: CustomLspClient }> => {
    const { workspace, client } = makeWorkspace(
      'python',
      async () => DISK,
      setFileValue,
      openEditorFile,
      ensureFileValue,
    );
    workspace.createNodeFile(OTHER_PATH);
    await workspace.waitForPendingDiskOpen(OTHER_PATH);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();
    return { workspace, client };
  };

  it('creates the subject and writes, without ever opening the file', async () => {
    const writes: [string, string][] = [];
    const ensured: string[] = [];
    const opened: string[] = [];
    let hasSubject = false;

    const { workspace } = await trackViewlessFile(
      (fileId, value) => {
        // Mirrors the store: nothing to write to until a subject exists.
        if (!hasSubject) return false;
        writes.push([fileId, value]);
        return true;
      },
      async (fileId) => {
        ensured.push(fileId);
        hasSubject = true;
        return DISK;
      },
      (uri) => opened.push(uri),
    );

    const applied = await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    expect(applied).toBe(true);
    expect(ensured).toEqual([OTHER_PATH]);
    expect(writes).toEqual([[OTHER_PATH, 'badGood = 1']]);
    // The whole point of B: no selection, no tab, no focus change.
    expect(opened).toEqual([]);
  });

  it('skips and re-aligns the server when the file changed underneath it', async () => {
    const writes: [string, string][] = [];
    let hasSubject = false;

    const { workspace, client } = await trackViewlessFile(
      (fileId, value) => {
        if (!hasSubject) return false;
        writes.push([fileId, value]);
        return true;
      },
      async () => {
        hasSubject = true;
        // Disk has moved on from what the server was given, so the
        // server-computed offsets no longer describe this text.
        return 'something entirely different';
      },
    );

    const applied = await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    // Better to report than to splice a document.
    expect(applied).toBe(false);
    expect(writes).toEqual([]);
    // ...but the server is re-aligned so a repeated rename works from a sound base.
    expect(workspace.getFile(OTHER_URI)?.doc.toString()).toBe(
      'something entirely different',
    );
    expect(didChangeCalls(client)).toHaveLength(1);
  });

  it('leaves the server untouched when the subject cannot be created', async () => {
    const { workspace, client } = await trackViewlessFile(
      () => false,
      async () => undefined,
    );

    const applied = await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    expect(applied).toBe(false);
    expect(didChangeCalls(client)).toHaveLength(0);
    expect(workspace.getFile(OTHER_URI)?.doc.toString()).toBe(DISK);
  });
});

/**
 * Disk and store content carry the file's raw line endings; editor docs never do
 * (EditorState.create splits on \r\n). Every doc this workspace builds from raw
 * content must be normalized the same way, or a CRLF file disagrees with its own
 * editor forever: phantom re-syncs on every open, and the "changed underneath"
 * guard in applyFileUpdate rejecting every cross-file edit.
 */
describe('CRLF content', () => {
  const HEADER = 'sketch/utils.h';
  const HEADER_URI = `${WORKSPACE_URI}/${HEADER}`;

  it('does not re-sync when a view attaches to a file tracked from CRLF disk content', async () => {
    const disk = 'inline void log_action() {}\r\nint x;\r\n';
    const { workspace, client } = makeWorkspace('arduino', async () => disk);
    workspace.createNodeFile(HEADER);
    await workspace.waitForPendingDiskOpen(HEADER);
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    // What the editor holds for the same file: normalized, no \r anywhere.
    workspace.openFile(
      HEADER_URI,
      'h',
      makeView('inline void log_action() {}\nint x;\n'),
    );

    expect(didChangeCalls(client)).toHaveLength(0);
    expect(client.deleteDiagnostics).not.toHaveBeenCalled();
  });

  it('treats identical CRLF disk content as unchanged in refreshFile', async () => {
    const disk = 'a = 1\r\nb = 2';
    const { workspace, client } = makeWorkspace('python', async () => disk);
    workspace.createNodeFile('other.py');
    await workspace.waitForPendingDiskOpen('other.py');
    (client.notification as ReturnType<typeof vi.fn>).mockClear();

    workspace.refreshFile('other.py', disk);

    expect(didChangeCalls(client)).toHaveLength(0);
  });

  it('applies a store-write edit when the store still holds CRLF line endings', async () => {
    const DISK = 'bad = 1\r\nok = 2';
    const OTHER_URI = `${WORKSPACE_URI}/other.py`;
    const writes: [string, string][] = [];
    let hasSubject = false;

    const { workspace } = makeWorkspace(
      'python',
      async () => DISK,
      (fileId, value) => {
        if (!hasSubject) return false;
        writes.push([fileId, value]);
        return true;
      },
      () => undefined,
      async () => {
        hasSubject = true;
        return DISK;
      },
    );
    workspace.createNodeFile('other.py');
    await workspace.waitForPendingDiskOpen('other.py');

    const applied = await workspace.applyFileUpdate(OTHER_URI, {
      changes: { from: 0, to: 3, insert: 'badGood' },
    });

    // The store's CRLF copy and the normalized file.doc are the same content,
    // not a "changed underneath the server" divergence. The written value is
    // doc-derived and therefore normalized — the same thing an editor save
    // does to a CRLF file.
    expect(applied).toBe(true);
    expect(writes).toEqual([['other.py', 'badGood = 1\nok = 2']]);
  });
});
