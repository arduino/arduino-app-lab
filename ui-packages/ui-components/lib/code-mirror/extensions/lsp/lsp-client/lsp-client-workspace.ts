import { setDiagnostics } from '@codemirror/lint';
import {
  LSPPlugin,
  Workspace,
  WorkspaceFile,
  WorkspaceMapping,
} from '@codemirror/lsp-client';
import { ChangeSet, TransactionSpec } from '@codemirror/state';
import { Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { FileChangeType } from 'vscode-languageserver-protocol';

import { FileNode } from '../../../../file-tree';
import { contentToText } from '../../../utils';
import { LSP_LANGS } from '../lsp-consts';
import {
  isWithinUri,
  joinFileUri,
  normalizeFileUri,
  relativeUriPath,
} from '../lsp-file-uri';
import {
  LspDiagnostic,
  LspDidChangeTextDocumentParams,
  LspDidChangeWatchedFilesParams,
  LspFileEvent,
  LspId,
  LspLang,
  LspPosition,
  LspTextDocumentContentChangeEvent,
  LspTextDocumentEdit,
  LspTextEdit,
  LspWorkspaceEdit,
} from '../lsp-types';
import { CustomLspClient } from './lsp-client-types';

const LSP_DIAGNOSTIC_TO_CM_SEVERITY = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
} as const;

// App Lab apps compile from the top-level `sketch/` folder, so only structural
// changes to Arduino sources under it change what the sketch builds.
const SKETCH_DIR = 'sketch';

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean =>
  code >= 0xdc00 && code <= 0xdfff;

interface WorkspaceFileUpdate {
  file: LspClientWorkspaceFile;
  prevDoc: Text;
  changes: ChangeSet;
}

/**
 * Workspace used by @codemirror/lsp for file management(open, close, update,..)
 */
export class LspClientWorkspace extends Workspace {
  files: LspClientWorkspaceFile[] = [];

  // Correlates the post-restart re-lint to the restart's *own* background-index
  // pass: a sketch move-in arms it (`awaitingIndex`), the next index `begin`
  // (the restart's) moves it to `indexing`, and that pass's `end` flushes the
  // re-lint. An index pass already running when the move-in lands ends while
  // still `awaitingIndex` and is ignored, so the re-lint can't be consumed by
  // the wrong pass. Kept in sync with the Go restart gate in lsp.go.
  private sketchRelintState: 'idle' | 'awaitingIndex' | 'indexing' = 'idle';

  constructor(
    client: CustomLspClient,
    private lspId: LspId,
    private workspaceUri: string,
    private openEditorFile: (fileUri: string) => void | Promise<void>,
    private filesList?: FileNode[],
    private getLspWorkspaceFile?: (fileUri: string) => Promise<string>,
    private getActiveView?: () => EditorView | null,
    /**
     * Write a file's full content to the app's content store, keyed by its
     * workspace-relative id. Lets a server-initiated edit reach a file that is
     * not on screen without opening it — see applyFileUpdateWithoutView. Returns
     * whether the write landed: the store creates a file's content subject lazily
     * on first open, so it has nowhere to put text for a file untouched this
     * session, and that path must then fall back to opening the file.
     */
    private setFileValue?: (fileId: string, value: string) => boolean,
    /**
     * Create and populate a file's content subject without selecting it,
     * resolving to the content it now holds. Needed because the store creates
     * subjects lazily on first open, so setFileValue has nowhere to write for a
     * file untouched this session — see applyFileUpdateWithoutView.
     */
    private ensureFileValue?: (fileId: string) => Promise<string | undefined>,
  ) {
    super(client);
  }

  private get customClient(): CustomLspClient {
    return this.client as CustomLspClient;
  }

  openFile(uri: string, languageId: string, view: EditorView): void {
    let file = this.getFile(uri);

    if (!file) {
      file = new LspClientWorkspaceFile(
        uri,
        languageId,
        1,
        view.state.doc,
        view,
      );
      this.files.push(file);
      this.client.didOpen(file);

      this.openAllLspFiles();
    } else {
      file.addView(view);
      if (!view.state.doc.eq(file.doc)) {
        // The buffer was reloaded in place underneath the editor (external
        // change picked up by the file watcher): the view was rebuilt around
        // the fresh content, but the server still holds the previous doc —
        // and `file.doc` is what every subsequent didChange range is computed
        // against, so leaving it stale desyncs all later edits. Sync the
        // server's copy (a minimal ranged edit, like typing) and drop the
        // cached diagnostics, whose positions belong to the replaced doc; the
        // didChange makes the server publish a fresh set.
        this.replaceFileDoc(file, view.state.doc);
        this.customClient.deleteDiagnostics(uri);
      } else if (this.lspId === 'arduino') {
        // The Arduino LS republishes stale diagnostics while it rebuilds its
        // compilation database, so re-linting on a tab switch flashes wrong
        // results. Repaint the diagnostics we already cached instead; the
        // server still pushes fresh ones for open files when they actually
        // change.
        this.paintCachedDiagnostics(uri, view);
      } else {
        this.triggerDiagnostics(file, view);
      }
    }
  }

  closeFile(uri: string, view: EditorView): void {
    // We intentionally do not call didClose() or remove from this.files to keep cross-file features working
    const file = this.getFile(uri);
    if (!file) {
      return;
    }
    this.flushViewChanges(file, view);
    file.removeView(view);
  }

  /**
   * Flush edits still waiting in a closing view's plugin. closeFile is called
   * from the plugin's destroy (tab switch / buffer reload), which cancels the
   * pending autoSync debounce — edits made inside that window would otherwise
   * never reach the server, whose didOpen'd buffer then masks the saved file
   * on disk until the tab is reopened. Skipped when another pane still shows
   * the file: its plugin carries the same changes and syncs normally.
   */
  private flushViewChanges(
    file: LspClientWorkspaceFile,
    view: EditorView,
  ): void {
    const hasOtherViews = file.getViews().some((v) => v !== view);
    if (hasOtherViews) {
      return;
    }
    // Still resolvable here: CodeMirror destroys the old plugins before it
    // installs a new state's set.
    const plugin = LSPPlugin.get(view);
    if (!plugin || plugin.uri !== file.uri) {
      return;
    }
    const changes = plugin.unsyncedChanges;
    if (changes.empty) {
      return;
    }
    const contentChanges: LspTextDocumentContentChangeEvent[] = [];
    changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      contentChanges.push({
        range: {
          start: this.toPosition(file.doc, fromA),
          end: this.toPosition(file.doc, toA),
        },
        text: inserted.toString(),
      });
    });
    contentChanges.reverse();

    file.doc = changes.apply(file.doc);
    this.didChange(file, contentChanges);
  }

  /**
   * Called by @codemirror/lsp-client before start every request to LS to sync unsynced files
   * We intentionally return [] cause we want to custom handle didChange instead of rely on @codemirror/lsp-client handling
   */
  syncFiles(): WorkspaceFileUpdate[] {
    for (const file of this.files) {
      const views = file.getViews();
      if (views.length === 0) {
        continue;
      }

      // When the file is shown in several panes, split-sync keeps their docs identical,
      // so read the unsynced changes from one view and send a single didChange.
      const view = views[0];
      const plugin = LSPPlugin.get(view);
      if (!plugin) {
        continue;
      }

      const changes = plugin.unsyncedChanges;
      if (!changes.empty) {
        const contentChanges: LspTextDocumentContentChangeEvent[] = [];
        changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
          contentChanges.push({
            range: {
              start: this.toPosition(file.doc, fromA),
              end: this.toPosition(file.doc, toA),
            },
            text: inserted.toString(),
          });
        });
        contentChanges.reverse();

        file.doc = view.state.doc;
        // clear every pane's plugin, otherwise the mirrored peer would re-send the same edit on the next sync.
        for (const view of views) {
          LSPPlugin.get(view)?.clear();
        }

        this.didChange(file, contentChanges);
      }
    }
    return [];
  }

  override getFile(uri: string): LspClientWorkspaceFile | null {
    const normalized = normalizeFileUri(uri);
    return (
      this.files.find((f) => normalizeFileUri(f.uri) === normalized) || null
    );
  }

  /**
   * Called by CM/SLP jump-to/find-all-refs and this.updateFile() to open a file and get its view
   */
  override displayFile(uri: string): Promise<EditorView | null> {
    this.openEditorFile(uri);

    /**
     * Use setInterval (max 10 attempts, 100ms frequency) to resolve only when the file is available in the workspace.
     * If the file is already open it will resolve faster than when it needs to be opened and added to the workspace.
     *
     * When an active pane is known, prefer its view: `openEditorFile` just
     * opened the target there, so we wait for that pane to actually show the
     * file rather than resolving whichever pane registered it first (which
     * would send navigation to the wrong pane when the file is already open
     * elsewhere). The `getView()` fallback keeps single-editor consumers and
     * the timeout path working.
     */
    return new Promise<EditorView | null>((resolve) => {
      let attempts = 0;

      const resolveWith = (view: EditorView | null): void => {
        clearInterval(interval);
        view?.focus();
        resolve(view);
      };

      const interval = setInterval(() => {
        attempts++;

        const file = this.getFile(uri);
        const activeView = this.getActiveView?.();

        if (activeView) {
          const activePluginUri = LSPPlugin.get(activeView)?.uri;
          // Resolve once the active pane is showing this file.
          if (
            activePluginUri &&
            normalizeFileUri(activePluginUri) === normalizeFileUri(uri)
          ) {
            resolveWith(activeView);
            return;
          }
        } else {
          // No active-pane preference: resolve as soon as any view exists.
          const view = file?.getView();
          if (view) {
            resolveWith(view);
            return;
          }
        }

        if (attempts >= 10) {
          resolveWith(file?.getView() ?? null);
          return;
        }
      }, 100);
    });
  }

  /**
   * Called by @codemirror/lsp-client when client.disconnect() is called
   */
  override disconnected(): void {
    this.files = [];
    this.sketchRelintState = 'idle';
  }

  /**
   * Called when a server-initiated change to a file has to be applied (e.g: rename symbol)
   * When rename changes involves only the current open file the default CM updateFile() implementation would be fine,
   * but when rename changes involves files that are not open we need to handle it differently.
   * We need to call displayFile() to open the file before apply changes(we need CM view).
   * displayFile() is an async operation so any updateFile() call need to wait for the previous update to complete.
   * When the file already has a live view (it's shown in a pane) we dispatch into it directly instead of opening it via displayFile().
   */
  private updateFileQueue: Promise<unknown> = Promise.resolve();
  override async updateFile(
    uri: string,
    update: TransactionSpec,
  ): Promise<void> {
    await this.applyFileUpdate(uri, update);
  }

  /**
   * updateFile, reporting whether the edit actually reached a document. A
   * cross-file edit that resolves no view must not be mistaken for a success:
   * that is how a rename ends up changing nothing while looking like it worked
   * (see applyWorkspaceEditChanges).
   */
  async applyFileUpdate(
    uri: string,
    update: TransactionSpec,
  ): Promise<boolean> {
    const previousUpdate = this.updateFileQueue;

    const applied = (async (): Promise<boolean> => {
      try {
        await previousUpdate;

        const file = this.getFile(uri);
        const view = file?.getView() ?? null;

        // The file is on screen: dispatch into it, so the edit is visible at
        // once and joins that editor's undo history.
        if (view) {
          view.dispatch(update);
          this.client.sync();
          return true;
        }

        // External files are read-only and never edited.
        if (this.isExternalUri(uri)) {
          return false;
        }

        // Tracked but not on screen: write it through the content store. Never
        // force it open — a cross-file rename would otherwise select each file it
        // touches, leaving the user on whichever uri the server happened to list
        // last (object key order) with a permanent tab per file, since editing a
        // preview tab commits it. See applyFileUpdateWithoutView.
        if (file && this.setFileValue) {
          return await this.applyFileUpdateWithoutView(file, update);
        }

        // Either untracked (created after the LSP started, so there is no file.doc
        // to compute against) or no store writer is wired up at all, as for a
        // consumer that does not pass one. Opening it is the only way left to apply
        // the edit, and skipping would silently drop this document's part of a
        // cross-file rename. Rare: applyWorkspaceEditChanges skips uris the
        // WorkspaceMapping does not know before it reaches here.
        const openedView = await this.displayFile(uri);
        if (!openedView) {
          return false;
        }
        openedView.dispatch(update);
        this.client.sync();
        return true;
      } catch (error) {
        console.error('LSP updateFile error:', error);
        return false;
      }
    })();

    this.updateFileQueue = applied;
    return applied;
  }

  /**
   * Apply a server-initiated edit to a tracked file that has no view, by writing
   * the result to the content store instead of opening the file in a pane.
   *
   * Dispatching into a view was the only way this used to work, so a cross-file
   * rename opened every file it touched — and the edit was then routinely
   * undone. The editor's `onChange` writes to whichever file the app currently
   * has *selected*, not the file the transaction belonged to, so an edit
   * dispatched into a just-opened pane raced React committing that selection: the
   * new text went to the wrong key, the file's own content stayed stale, and the
   * next state rebuild (the store is the source of truth) reverted the document.
   * That is the "flash of the new name, then back to the old" — and it needed a
   * slow machine to lose the race, which is why only a VM showed it.
   *
   * Writing to the store keyed by this file's own id removes the race entirely,
   * and stops the surprise navigation as a side effect. The server is kept in
   * step by replaceFileDoc, since the library's syncFiles() only walks files that
   * have a view and would never send this change.
   *
   * The trade-off: with no view there is no undo history to add to, so this edit
   * is not locally undoable until the file is opened.
   *
   * Returns false when the store could not take the write — the content subject is
   * created lazily on first open, so a file untouched this session has nowhere to
   * put it. The caller must then fall back to opening the file. Getting this wrong
   * corrupted documents: an earlier version advanced the server *before* the write
   * and reported success regardless, so for a never-opened header the server and
   * `file.doc` moved to the renamed text while the store and disk kept the old, and
   * `applied` hid it. The next rename was then computed against the server's copy
   * and applied at offsets that no longer matched what the file actually held,
   * splicing the two together ("DAVEA" + "DAVE" -> "DAVEADAVE").
   */
  private async applyFileUpdateWithoutView(
    file: LspClientWorkspaceFile,
    update: TransactionSpec,
  ): Promise<boolean> {
    if (!this.setFileValue) {
      return false;
    }
    const fileId = relativeUriPath(file.uri, this.workspaceUri);
    if (!fileId) {
      // Outside the workspace: no id the store would recognise.
      return false;
    }

    // `update.changes` are offsets into this file's own doc, which is exactly
    // what `file.doc` holds (applyWorkspaceEditChanges maps them through the
    // WorkspaceMapping for this uri).
    const changes = ChangeSet.of(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update.changes as any,
      file.doc.length,
    );
    if (changes.empty) {
      return false;
    }
    const nextDoc = changes.apply(file.doc);

    // The store is the source of truth, so it goes first and the server only
    // follows once the write is known to have landed. Advancing the server on a
    // write that silently did nothing is what desynced the two copies.
    if (this.writeFileValue(file, fileId, nextDoc)) {
      return true;
    }

    // No subject yet, so the file has never been opened this session. Create and
    // populate one, then write; this is the case that used to force the file open.
    if (!this.ensureFileValue) {
      return false;
    }
    const resolved = await this.ensureFileValue(fileId);
    if (resolved === undefined) {
      return false;
    }

    // Because a subject only appears on first open, "no subject" implies the file
    // cannot hold unsaved edits, so the content just fetched should equal the copy
    // the server was given. If it does not, our baseline moved underneath us (a
    // disk change the watcher has not picked up) and the server-computed offsets no
    // longer describe this text — applying them anyway is what splices a document.
    // Re-align the server to the real content and report the edit as not applied;
    // the caller surfaces it and a repeated rename then works from a sound base.
    // Compared as Texts, not strings: `resolved` carries the file's raw line
    // endings while `file.doc` is normalized the way every editor doc is, so a
    // string comparison would flag every CRLF file as changed forever.
    const resolvedDoc = contentToText(resolved);
    if (!resolvedDoc.eq(file.doc)) {
      console.warn(
        `[lsp] ${fileId} changed underneath the language server; skipping this edit`,
      );
      this.replaceFileDoc(file, resolvedDoc);
      return false;
    }

    return this.writeFileValue(file, fileId, nextDoc);
  }

  /**
   * Publish `nextDoc` as the file's content and, only if that lands, move the
   * server to match. Reports whether it did.
   */
  private writeFileValue(
    file: LspClientWorkspaceFile,
    fileId: string,
    nextDoc: Text,
  ): boolean {
    if (!this.setFileValue?.(fileId, nextDoc.toString())) {
      return false;
    }
    this.replaceFileDoc(file, nextDoc);
    return true;
  }

  private didChange(
    file: LspClientWorkspaceFile,
    contentChanges: LspTextDocumentContentChangeEvent[],
  ): void {
    this.client.notification<LspDidChangeTextDocumentParams>(
      'textDocument/didChange',
      {
        textDocument: { uri: file.uri, version: ++file.version },
        contentChanges,
      },
    );
  }

  /**
   * Sync the server's copy of `file` to `doc`, keeping `file.doc` (the doc
   * every didChange range is computed against) in step. Sends the smallest
   * single-range didChange (common prefix/suffix trimmed) rather than a
   * whole-document replace: a small ranged edit takes the same light
   * incremental path as typing, while replacing the full document forces the
   * Arduino LS to rebuild the preprocessed sketch and reindex — surfacing the
   * loader and stale diagnostics on every external change. The range is
   * computed against the *previous* doc — the content the server currently
   * holds. No-op when the docs are identical.
   */
  private replaceFileDoc(file: LspClientWorkspaceFile, doc: Text): void {
    const prevDoc = file.doc;
    const prev = prevDoc.toString();
    const next = doc.toString();

    // Trim the common prefix and suffix (in UTF-16 code units, the measure
    // both CodeMirror offsets and LSP positions use).
    let start = 0;
    const maxStart = Math.min(prev.length, next.length);
    while (
      start < maxStart &&
      prev.charCodeAt(start) === next.charCodeAt(start)
    ) {
      start++;
    }
    let prevEnd = prev.length;
    let nextEnd = next.length;
    while (
      prevEnd > start &&
      nextEnd > start &&
      prev.charCodeAt(prevEnd - 1) === next.charCodeAt(nextEnd - 1)
    ) {
      prevEnd--;
      nextEnd--;
    }

    if (start === prevEnd && start === nextEnd) {
      file.doc = doc;
      return;
    }

    // Never split a surrogate pair: widen the changed range outward instead.
    if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) {
      start--;
    }
    if (prevEnd < prev.length && isLowSurrogate(prev.charCodeAt(prevEnd))) {
      prevEnd++;
      nextEnd++;
    }

    file.doc = doc;
    this.didChange(file, [
      {
        text: next.slice(start, nextEnd),
        range: {
          start: this.toPosition(prevDoc, start),
          end: this.toPosition(prevDoc, prevEnd),
        },
      },
    ]);
  }

  /**
   * Send didChange notification just to trigger LS and get `publishDiagnostics`.
   * Trick is send full range (from file start to end) with full text content.
   * We trigger diagnostics because changes in other files may require updating diagnostics in this file when re-opened
    (eg: an imported function was renamed in its definition file)
   */
  private triggerDiagnostics(
    file: LspClientWorkspaceFile,
    view: EditorView,
  ): void {
    const lastLine = view.state.doc.line(view.state.doc.lines);
    const endLine = lastLine.number - 1;
    const endCharacter = lastLine.length;

    const contentChanges: LspTextDocumentContentChangeEvent[] = [
      {
        text: view.state.doc.toString(),
        range: {
          start: { line: 0, character: 0 },
          end: {
            line: endLine,
            character: endCharacter,
          },
        },
      },
    ];

    this.didChange(file, contentChanges);
  }

  /**
   * Repaint the last diagnostics published for `uri` onto a freshly opened
   * view. @codemirror/lsp-client's `serverDiagnostics()` only paints on a
   * server push, so a view opened on a tab switch would otherwise show nothing
   * until the next publish. Reusing the cached set avoids forcing the Arduino
   * LS to re-lint (which briefly republishes stale results while it rebuilds).
   * Deferred to a microtask because the view's LSPPlugin is wired only after
   * this openFile() call returns.
   */
  private paintCachedDiagnostics(uri: string, view: EditorView): void {
    const diagnostics = this.customClient.getDiagnostics(uri);
    if (!diagnostics) {
      return;
    }
    queueMicrotask(() => {
      if (!view.dom.isConnected) {
        return;
      }
      const plugin = LSPPlugin.get(view);
      if (!plugin || plugin.uri !== uri) {
        return;
      }
      view.dispatch(
        setDiagnostics(
          view.state,
          diagnostics.map((diagnostic: LspDiagnostic) => ({
            from: plugin.unsyncedChanges.mapPos(
              plugin.fromPosition(diagnostic.range.start, plugin.syncedDoc),
            ),
            to: plugin.unsyncedChanges.mapPos(
              plugin.fromPosition(diagnostic.range.end, plugin.syncedDoc),
            ),
            severity: LSP_DIAGNOSTIC_TO_CM_SEVERITY[diagnostic.severity ?? 1],
            message: diagnostic.message,
          })),
        ),
      );
    });
  }

  private toPosition(doc: Text, pos: number): LspPosition {
    const line = doc.lineAt(pos);
    return { line: line.number - 1, character: pos - line.from };
  }

  /**
   * Called on first LSP file open to open all the other file with the same LSP.
   * This in necessary to let cross-file features like go-to-def/find-all-refs/rename work.
   */
  private openAllLspFiles(): void {
    this.filesList
      ?.filter((file) => {
        // keep only files handled by this workspace's LSP
        const lang = file.extension.split('.').pop();
        return LSP_LANGS[lang as LspLang] === this.lspId;
      })
      .forEach((f) => {
        this.trackFileFromDisk(
          this.getUriByPath(f.path),
          f.extension.split('.').pop() ?? '',
        );
      });
  }

  // In-flight disk-driven didOpens, keyed by uri. Lets external-change
  // handling await the open it may be racing (see waitForPendingDiskOpen), so
  // a change event landing mid-fetch can't slip past a stale didOpen.
  private pendingDiskOpens = new Map<string, Promise<void>>();

  /**
   * Track a file the user hasn't opened in an editor: read its content from
   * disk and didOpen it, so cross-file features and server-initiated edits
   * treat it like any other document. No-op if already tracked or the open is
   * already in flight.
   */
  private trackFileFromDisk(fileUri: string, languageId: string): void {
    if (this.getFile(fileUri) || this.pendingDiskOpens.has(fileUri)) {
      return;
    }

    const open = (async (): Promise<void> => {
      try {
        const fileContent = await this.getLspWorkspaceFile?.(fileUri);
        if (fileContent === undefined) {
          return;
        }

        // check if user has already opened this file during file content fetching
        if (this.getFile(fileUri)) {
          return;
        }

        // Normalized like an editor doc, so `openFile`'s doc.eq check doesn't
        // see a phantom mismatch when a view later attaches to a CRLF file.
        const text = contentToText(fileContent);
        const file = new LspClientWorkspaceFile(fileUri, languageId, 1, text);

        this.files.push(file);
        this.client.didOpen(file);
      } catch (error) {
        console.error(`LSP opening file error: ${fileUri}`, error);
      }
    })();

    this.pendingDiskOpens.set(fileUri, open);
    void open.finally(() => this.pendingDiskOpens.delete(fileUri));
  }

  /**
   * Wait for any in-flight disk-driven didOpen of `path`, so callers deciding
   * how to sync an external change observe the tracked state it establishes
   * rather than racing it.
   */
  async waitForPendingDiskOpen(path: string): Promise<void> {
    await this.pendingDiskOpens.get(this.getUriByPath(path));
  }

  private getUriByPath(path: string): string {
    return joinFileUri(this.workspaceUri, path);
  }

  /**
   * Called when a new file is created (filetree UI, or an external create seen
   * by the file watcher). Announces the file on disk so the server drops any
   * negative import-resolution cache and re-resolves references to it from
   * *other* open files (e.g. an adjacent file that imports the new one), then
   * tracks it like the startup set (openAllLspFiles) so later external changes
   * and server-initiated edits treat it as a first-class document. Tracking is
   * skipped for paths this LSP doesn't handle — including folder paths from
   * watcher create events, whose "extension" matches no LSP language.
   */
  createNodeFile(path: string): void {
    const fileUri = this.getUriByPath(path);
    this.notifyFilesChangedOnDisk([
      { uri: fileUri, type: FileChangeType.Created },
    ]);

    const lang = path.split('.').pop();
    if (LSP_LANGS[lang as LspLang] === this.lspId) {
      this.trackFileFromDisk(fileUri, lang ?? '');
    }
  }

  /**
   * Called when a file is renamed/moved in filetree
   */
  renameOrMoveNodeFile(oldPath: string, newPath: string): void {
    const oldFileUri = this.getUriByPath(oldPath);
    const newFileUri = this.getUriByPath(newPath);

    const file = this.getFile(oldFileUri);
    if (file) {
      this.renameFile(file, newFileUri);
      this.notifyFilesChangedOnDisk([
        { uri: oldFileUri, type: FileChangeType.Deleted },
        { uri: newFileUri, type: FileChangeType.Created },
      ]);
    }
  }

  /**
   * Called when a folder is renamed/moved in filetree
   */
  renameOrMoveNodeFolder(oldPath: string, newPath: string): void {
    const oldFolderUri = this.getUriByPath(oldPath);
    const newFolderUri = this.getUriByPath(newPath);

    const changes: LspFileEvent[] = [];
    this.files.forEach((file) => {
      // Re-root through the uri helpers rather than a string replace: replace()
      // would rewrite the first match anywhere in the uri, not just the prefix.
      const relative = relativeUriPath(file.uri, oldFolderUri);
      if (relative !== null) {
        const oldFileUri = file.uri;
        const newFileUri = joinFileUri(newFolderUri, relative);
        this.renameFile(file, newFileUri);
        changes.push(
          { uri: oldFileUri, type: FileChangeType.Deleted },
          { uri: newFileUri, type: FileChangeType.Created },
        );
      }
    });
    this.notifyFilesChangedOnDisk(changes);
  }

  private renameFile(file: LspClientWorkspaceFile, newFileUri: string): void {
    // if a file with 'newFileUri' already exists it means that filetree is operating a drag&drop with overwrite option, so file has to be closed
    const newFile = this.getFile(newFileUri);
    if (newFile) {
      this.files = this.files.filter((f) => f !== newFile);
      this.client.didClose(newFileUri);
    }
    // close old file
    this.client.didClose(file.uri);

    // open new file
    file.uri = newFileUri;
    this.client.didOpen(file);
  }

  /**
   * After a rename/move we re-sync the moved documents with didClose/didOpen,
   * but that only refreshes the moved files themselves. The server keeps the
   * import/module resolution it cached for every *other* open file, so it goes
   * on resolving imports against the old paths and cross-file symbol
   * recognition (go-to-def, "name is not defined") silently breaks until the
   * workspace is reloaded. A `workspace/didChangeWatchedFiles` notification
   * tells the server the on-disk layout changed, forcing it to drop those
   * caches and re-resolve. Sent after the didOpen so the moved documents are
   * already open when the server re-resolves. No-op for an empty change set.
   */
  private notifyFilesChangedOnDisk(changes: LspFileEvent[]): void {
    if (changes.length === 0) {
      return;
    }
    this.client.notification<LspDidChangeWatchedFilesParams>(
      'workspace/didChangeWatchedFiles',
      { changes },
    );
    if (this.lspId === 'arduino') {
      this.scheduleSketchRelint(changes);
    } else {
      this.relintMovedFiles(changes);
    }
  }

  /**
   * True when `uri` is an Arduino source file (ino/c/cpp/h/hpp) inside the
   * app's top-level `sketch/` folder — the files whose presence changes what
   * the sketch compiles. Mirrors the Go restart gate (isArduinoSourceURI +
   * sketchDirName in lsp.go); keep the two in sync.
   */
  private isSketchArduinoUri(uri: string): boolean {
    if (!isWithinUri(uri, joinFileUri(this.workspaceUri, SKETCH_DIR))) {
      return false;
    }
    const lang = uri.split('.').pop();
    return LSP_LANGS[lang as LspLang] === 'arduino';
  }

  /**
   * Arm a re-lint of the viewed files whenever an Arduino source appears inside
   * `sketch/`. Such a create is always followed by a background-index pass:
   *   - a UI move-in makes the desktop app restart the Arduino LS (to rebuild
   *     its compile tracking), and the restart runs an index pass;
   *   - an external create/move-in (e.g. a terminal `mv` back into sketch/)
   *     makes the desktop restart the Arduino LS off the same
   *     `didChangeWatchedFiles` we just sent: the LS itself never receives it
   *     (its handler panics — the Go side suppresses the message and treats
   *     any sketch-source change as the restart trigger; see the gate in
   *     lsp.go).
   * Either way the index restores cross-file resolution but leaves the open
   * files' diagnostics stale, so we defer the re-lint until that pass ends (see
   * markSketchRestartIndexing / flushPendingSketchRelint) instead of hitting the
   * server mid-rebuild. A source *leaving* sketch/ (its Created lands outside)
   * is reconciled by the plain rebuild and never arms — nor does anything for
   * pyright or files outside sketch/.
   */
  private scheduleSketchRelint(changes: LspFileEvent[]): void {
    const entersSketch = changes.some(
      (c) =>
        c.type === FileChangeType.Created && this.isSketchArduinoUri(c.uri),
    );
    if (entersSketch) {
      this.sketchRelintState = 'awaitingIndex';
    }
  }

  /**
   * Re-analyse the files moved by a rename/move so their own imports re-resolve.
   * Each moved file's didClose/didOpen is sent *before* the
   * `workspace/didChangeWatchedFiles` above, so a server that resolves imports
   * against a directory cache (pyright) re-analyses the reopened document while
   * its view of the tree is still stale — an intra-package relative import
   * (`from . import sibling`) then binds against the old layout and stays stale.
   * A full-content didChange issued after the watched-files event re-analyses
   * each moved file against the refreshed tree. Only runs for a move (a Created
   * paired with a Deleted); pure create/delete are reconciled by the
   * watched-files event alone, and the Arduino LS is handled separately via
   * scheduleSketchRelint (full restart).
   */
  private relintMovedFiles(changes: LspFileEvent[]): void {
    const isMove =
      changes.some((c) => c.type === FileChangeType.Created) &&
      changes.some((c) => c.type === FileChangeType.Deleted);
    if (!isMove) {
      return;
    }
    changes.forEach((change) => {
      if (change.type !== FileChangeType.Created) {
        return;
      }
      const file = this.getFile(change.uri);
      if (file) {
        this.sendFullDocumentDidChange(file);
      }
    });
  }

  /**
   * Send a full-content didChange for `file` without needing a live view — a
   * just-moved file's view still carries the old uri, so `getView()` can't be
   * used. Re-lints the document at its current uri so the server re-resolves.
   */
  private sendFullDocumentDidChange(file: LspClientWorkspaceFile): void {
    const doc = file.doc;
    const lastLine = doc.line(doc.lines);
    this.didChange(file, [
      {
        text: doc.toString(),
        range: {
          start: { line: 0, character: 0 },
          end: { line: lastLine.number - 1, character: lastLine.length },
        },
      },
    ]);
  }

  /**
   * Called on `$/progress backgroundIndexProgress` `begin`. Once a sketch move
   * has armed a re-lint, the first index pass to *begin* afterwards is the
   * restart's own, so mark it as indexing; that pass's `end` flushes the
   * re-lint. A pass already in flight when the move landed stays ignored.
   */
  markSketchRestartIndexing(): void {
    if (this.sketchRelintState === 'awaitingIndex') {
      this.sketchRelintState = 'indexing';
    }
  }

  /**
   * Re-lint the files currently shown in a pane after the Arduino LS has
   * restarted and finished the background-index pass that began after a sketch
   * move (see markSketchRestartIndexing). The restart replays the pre-move
   * document state — which restores cross-file resolution but leaves the open
   * files' diagnostics stale — so once that pass ends we replay each viewed
   * file's content as a full-document didChange to pull fresh cross-file
   * squiggles that match the new layout. No-op unless the restart's index pass
   * is what completed. Files that were just moved are skipped for free: their
   * view still carries the old uri, so `getView()` returns null.
   */
  flushPendingSketchRelint(): void {
    if (this.sketchRelintState !== 'indexing') {
      return;
    }
    this.sketchRelintState = 'idle';
    this.files.forEach((file) => {
      const view = file.getView();
      if (!view) {
        return;
      }
      // clangd/the Arduino LS don't reliably retract the diagnostics they
      // published while the header was outside `sketch/` (a file that becomes
      // clean often gets no empty-set publish), so the stale squiggles linger
      // even though resolution is restored. Clear them locally first, drop the
      // cached copy `paintCachedDiagnostics` would otherwise repaint, then
      // re-lint so any diagnostic that still applies to the new layout returns.
      view.dispatch(setDiagnostics(view.state, []));
      this.customClient.deleteDiagnostics(file.uri);
      this.triggerDiagnostics(file, view);
    });
  }

  /**
   * Called when a file is deleted in filetree
   */
  deleteNodeFile(path: string): void {
    const fileUri = this.getUriByPath(path);

    const file = this.getFile(fileUri);
    if (file) {
      this.files = this.files.filter((f) => f !== file);
      this.client.didClose(fileUri);
    }
    // Notify even when the file wasn't open here: other files may have
    // resolved it from disk, so the server still needs to drop that cache.
    this.notifyFilesChangedOnDisk([
      { uri: fileUri, type: FileChangeType.Deleted },
    ]);
  }

  /**
   * Called when a folder is deleted in filetree
   */
  deleteNodeFolder(path: string): void {
    const folderUri = this.getUriByPath(path);

    const toKeep: LspClientWorkspaceFile[] = [];
    const toDelete: LspClientWorkspaceFile[] = [];

    this.files.forEach((file) => {
      if (isWithinUri(file.uri, folderUri)) {
        toDelete.push(file);
      } else {
        toKeep.push(file);
      }
    });

    toDelete.forEach((file) => {
      this.client.didClose(file.uri);
    });

    this.files = toKeep;

    this.notifyFilesChangedOnDisk(
      toDelete.map((file) => ({
        uri: file.uri,
        type: FileChangeType.Deleted,
      })),
    );
  }

  /**
   * True when `uri` points outside this workspace root (e.g. a library/system
   * header opened via go-to-definition). Such files are read-only, so cross-file
   * edits (rename / code actions) must never be written to them.
   */
  isExternalUri(uri: string): boolean {
    return !isWithinUri(uri, this.workspaceUri);
  }

  /**
   * True when `path` is tracked by the LSP but not shown in any editor pane.
   * Such files only self-sync when opened, so an external change needs an
   * explicit `refreshFile` to keep cross-file features accurate.
   */
  needsExternalReload(path: string): boolean {
    const file = this.getFile(this.getUriByPath(path));
    return !!file && file.getViews().length === 0;
  }

  /**
   * Surgically sync an LSP-tracked file that changed on disk but is NOT shown
   * in an editor. Open files self-sync through the editor reload →
   * triggerDiagnostics path, so this is a no-op for them. Sends a full-content
   * didChange so cross-file features (go-to-def / find-refs) stay accurate.
   */
  refreshFile(path: string, content: string): void {
    const uri = this.getUriByPath(path);
    const file = this.getFile(uri);
    if (!file || file.getViews().length > 0) {
      return;
    }

    this.replaceFileDoc(file, contentToText(content));
  }

  /**
   * True when the LSP tracks `path` (didOpen'd — shown in an editor or not).
   */
  isTracked(path: string): boolean {
    return !!this.getFile(this.getUriByPath(path));
  }

  /**
   * Re-align a document whose server-side version diverged from ours — a
   * didChange was lost (e.g. sent while the backend LS was mid-crash), and
   * the version gate then discards EVERY subsequent publishDiagnostics for
   * the file: its squiggles freeze forever while the server is healthy.
   * Sends a rangeless full-content didChange (LSP full-sync form) so the
   * server jumps to a fresh version; its next publish then matches and
   * painting resumes. Guarded to once per client version — the resync bumps
   * it, so a repeat only fires if the server publishes stale again AFTER our
   * bump. Never for the Arduino LS: it panics on rangeless changes
   * ("full-text change not implemented"); its documents re-align through
   * the backend restart replay instead (the recovery snapshot folds our
   * didChanges).
   */
  resyncStaleDocument(uri: string): void {
    if (this.lspId === 'arduino') {
      return;
    }
    const file = this.getFile(uri);
    if (!file || file.lastResyncVersion === file.version) {
      return;
    }
    file.lastResyncVersion = file.version + 1;
    this.didChange(file, [{ text: file.doc.toString() }]);
  }

  /**
   * Tell the server `path` changed on disk. For files this LSP does NOT track
   * (e.g. sources inside an externally moved-in folder, which get no create
   * event of their own): the server reads them from disk on demand, so a
   * Changed watched-files event is what makes it drop its cached copy.
   */
  notifyWatchedFileChanged(path: string): void {
    this.notifyFilesChangedOnDisk([
      { uri: this.getUriByPath(path), type: FileChangeType.Changed },
    ]);
  }
}

export class LspClientWorkspaceFile implements WorkspaceFile {
  private views = new Set<EditorView>(); // split panel views

  // Client version at which the last stale-publish resync was sent (see
  // LspClientWorkspace.resyncStaleDocument). Prevents a resync storm while
  // one is already in flight.
  lastResyncVersion?: number;

  constructor(
    public uri: string,
    public languageId: string,
    public version: number,
    public doc: Text,
    view?: EditorView,
  ) {
    if (view) {
      this.views.add(view);
    }
  }

  getViews(): EditorView[] {
    return [...this.views].filter((view) => {
      const plugin = LSPPlugin.get(view);
      return !!plugin && plugin.uri === this.uri;
    });
  }

  // Primary live view. Kept for @codemirror/lsp-client, which addresses a file through a single view.
  getView(): EditorView | null {
    return this.getViews()[0] ?? null;
  }

  addView(view: EditorView): void {
    this.views.add(view);
  }

  removeView(view: EditorView): void {
    this.views.delete(view);
  }
}

/**
 * Pyright (rename) and the TS server (code actions) return `documentChanges` but @codemirror/lsp-client only reads the `changes` obj.
 * This normalizes any WorkspaceEdit to `changes`
 */

export const normalizeWorkspaceEdit = (
  edit: LspWorkspaceEdit,
): LspWorkspaceEdit => {
  if (!edit || !edit.documentChanges) {
    return edit;
  }

  const changes: Record<string, LspTextEdit[]> = {};
  const textDocumentKey: keyof LspTextDocumentEdit = 'textDocument';

  edit.documentChanges.forEach((dc) => {
    if (!(textDocumentKey in dc)) {
      return;
    }
    const uri = (dc as LspTextDocumentEdit).textDocument?.uri;
    if (!uri) {
      return;
    }
    const edits = (dc as LspTextDocumentEdit).edits;
    if (!edits?.length) {
      return;
    }
    (changes[uri] ??= []).push(...edits);
  });

  return { changes };
};

/**
 * What became of a WorkspaceEdit: the documents actually written, and the ones
 * the server named but we could not write. Callers must report an edit that
 * landed nowhere — a rename that silently changes nothing is indistinguishable
 * from a broken shortcut.
 */
export interface WorkspaceEditResult {
  applied: string[];
  skipped: SkippedWorkspaceEdit[];
}

/**
 * Why one document of an edit was not written. Each value names a different
 * gate, because they call for different answers and are indistinguishable from
 * the uri alone:
 *
 *  - `outside-workspace`: the uri did not resolve inside the workspace root.
 *    Either a genuinely external file (a library header a rename spanned into,
 *    read-only by design), or a spelling of an in-workspace path that our
 *    folding cannot see through — an 8.3 short path, a junction, a subst drive.
 *    Only the Go side can canonicalise those, so a report of this kind against
 *    a file the user can see in the tree belongs there (the workspace root is
 *    expanded in `tempWorkspaceBase`; check the desktop log for
 *    "could not expand workspace base to its long form").
 *  - `not-in-mapping`: in the workspace, but the request's position mapping
 *    never knew this document — it started being tracked after the request went
 *    out. Retrying the rename picks it up.
 *  - `no-document`: mapped, but no editor document could be resolved to write
 *    into (the file could not be opened in a pane, or the dispatch failed).
 */
export type SkippedWorkspaceEditReason =
  | 'outside-workspace'
  | 'not-in-mapping'
  | 'no-document';

export interface SkippedWorkspaceEdit {
  uri: string;
  reason: SkippedWorkspaceEditReason;
}

/** One log-ready line naming every skipped document and its gate. */
export const describeSkippedEdits = (skipped: SkippedWorkspaceEdit[]): string =>
  skipped.map(({ uri, reason }) => `${uri} (${reason})`).join(', ');

/**
 * Applies workspace edit changes coming from:
 * - `textDocument/rename`
 * - `textDocument/codeAction`
 * - `workspace/applyEdit`
 */
export const applyWorkspaceEditChanges = async ({
  client,
  edit,
  mapping,
  userEvent,
}: {
  client: CustomLspClient;
  edit: LspWorkspaceEdit;
  mapping: WorkspaceMapping;
  userEvent: string;
}): Promise<WorkspaceEditResult> => {
  const wsEdit = normalizeWorkspaceEdit(edit);
  const applied: string[] = [];
  const skipped: SkippedWorkspaceEdit[] = [];

  for (const uri in wsEdit.changes) {
    const lspChanges = wsEdit.changes[uri];
    if (!lspChanges?.length) {
      continue;
    }
    // Never write to read-only external files (e.g. library headers) that a
    // cross-file rename / code action may span into.
    if (client.workspace.isExternalUri(uri)) {
      skipped.push({ uri, reason: 'outside-workspace' });
      continue;
    }

    // A server may spell a uri differently than we opened it: on Windows
    // basedpyright/tsserver serialize any uri they didn't get from us as
    // `file:///c%3A/…` where we sent `file:///C:/…`. Our own lookups fold that
    // away (getFile), but @codemirror/lsp-client's WorkspaceMapping is a plain
    // Map keyed by our exact didOpen string, so positions have to be mapped
    // through OUR spelling of the uri.
    const localUri = client.workspace.getFile(uri)?.uri ?? uri;
    // …and a uri the mapping doesn't know at all (a file tracked after the
    // request went out) would make mapPosition throw, losing the whole edit
    // including the files that could have been written. Skip it instead.
    if (mapping.getMapping(localUri) === null) {
      skipped.push({ uri, reason: 'not-in-mapping' });
      continue;
    }

    const changed = await client.workspace.applyFileUpdate(localUri, {
      changes: lspChanges.map((change) => ({
        from: mapping.mapPosition(localUri, change.range.start),
        to: mapping.mapPosition(localUri, change.range.end),
        insert: change.newText,
      })),
      userEvent,
    });
    if (changed) {
      applied.push(uri);
    } else {
      skipped.push({ uri, reason: 'no-document' });
    }
  }

  return { applied, skipped };
};
