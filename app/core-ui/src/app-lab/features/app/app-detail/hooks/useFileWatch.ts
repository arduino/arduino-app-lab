import {
  CodeReloadCause,
  onWatcherRefresh,
  unwatchApp,
  watchApp,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { BoardScopedQuery } from '../../../../boardScopedQuery';
import { useBoardLifecycleStore } from '../../../../store/boardLifecycle';
import { getBoardCacheId } from '../../../../utils/board';
import { parentDir, resolveAbsPath, toAppRelativeId } from './filePaths';
import { APP_YAML_PATH, SKETCH_YAML_PATH } from './useAppFiles';
import { appDirKey } from './useAppFileTree';
import { keepMovedBuffer, UseFileOperationsReturn } from './useFileOperations';

// Fire-and-forget a watch/refresh operation, reporting rejections instead of
// leaving them as unhandled promise rejections.
const track = (label: string, op: Promise<unknown>): void => {
  void op.catch((error) =>
    console.error(`[file-watch] ${label} failed`, error),
  );
};

type UseFileWatchParams = {
  appId: string;
  appPath?: string;
  // Raw open-tab ids across both panels. Must be the unfiltered id state
  // (panel-A `openFileIds` + panel-B tab ids), NOT the meta-derived `openFiles` —
  // that drops any id whose metadata hasn't resolved yet, losing the very tab
  // we need to reconcile.
  openTabIds: string[];
  refreshFileContents: (
    ids: string[],
    cause?: CodeReloadCause,
  ) => Promise<void>;
  deleteFile: UseFileOperationsReturn['deleteFile'];
  // Drops a directory (and its descendants) from the listed set. A file path
  // matches no listed directory, so a removal can be reported blind.
  unlistDir: (dir: string) => void;
  // Drops what is cached for a listed directory while leaving it open, so it
  // refetches. A path that is not a listed directory is a no-op, so a create
  // can be reported blind.
  relistDir: (dir: string) => void;
  reloadLspFile?: (path: string) => Promise<void>;
  // Reconciles a watcher-detected structural change (create/remove, i.e. each
  // half of an external move) with every LS. No-op when LSP is disabled.
  syncLspWatchedChange?: (path: string, op: 'create' | 'remove') => void;
};

/**
 * Keeps the open app in sync with filesystem changes made outside App Lab. A
 * single recursive backend watch on the app covers everything — file content,
 * tree structure, and the manifests — and the backend classifies each change by
 * event type into a `refresh` kind. Torn down when the app closes.
 */
export function useFileWatch({
  appId,
  appPath,
  openTabIds,
  refreshFileContents,
  deleteFile,
  unlistDir,
  relistDir,
  reloadLspFile,
  syncLspWatchedChange,
}: UseFileWatchParams): void {
  const queryClient = useQueryClient();

  const connectedBoardCacheId = useBoardLifecycleStore((state) =>
    getBoardCacheId(state.selectedConnectedBoard),
  );

  // Latest open-tab abs paths, read by the (stable) refresh subscription so a
  // `file` event only reloads content when that file is actually open.
  const openAbsPathsRef = useRef<Map<string, string>>(new Map());
  // Latest open-tab ids (both panels), read by the subscription to reconcile
  // tabs on a `dir` remove. The open set — not the file tree — is the source
  // of truth here: a folder move fires only the top-level remove (no per-file
  // events), and the tree may already have been refetched by the create half.
  const openIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const map = new Map<string, string>();
    for (const id of openTabIds) {
      map.set(resolveAbsPath(id, appPath), id);
    }
    openAbsPathsRef.current = map;
    openIdsRef.current = openTabIds;
  }, [openTabIds, appPath]);

  // Latest deleteFile, read by the (stable) refresh subscription. Kept in a ref
  // so the subscription doesn't resubscribe every time its identity changes
  // (it closes over the file tree).
  const deleteFileRef = useRef(deleteFile);
  useEffect(() => {
    deleteFileRef.current = deleteFile;
  }, [deleteFile]);

  // Latest reloadLspFile, read by the (stable) refresh subscription so a
  // content change to a non-open, LS-tracked file can be synced surgically.
  const reloadLspFileRef = useRef(reloadLspFile);
  useEffect(() => {
    reloadLspFileRef.current = reloadLspFile;
  }, [reloadLspFile]);

  // Latest syncLspWatchedChange, read by the (stable) refresh subscription so a
  // `dir` create/remove (each half of an external move) reconciles the LS the
  // same way a UI create/move/delete does.
  const syncLspWatchedChangeRef = useRef(syncLspWatchedChange);
  useEffect(() => {
    syncLspWatchedChangeRef.current = syncLspWatchedChange;
  }, [syncLspWatchedChange]);

  const invalidateManifest = useCallback(() => {
    // A manifest change can restructure the app (a brick brings its own files),
    // so no single directory can be named — drop every listing for this app.
    queryClient.invalidateQueries({
      queryKey: [BoardScopedQuery.APP_DIR, appId],
    });
    queryClient.invalidateQueries({
      queryKey: [BoardScopedQuery.APP_BRICKS, appId],
    });
    queryClient.invalidateQueries({
      queryKey: [BoardScopedQuery.APP_SKETCH_LIBRARIES, appId],
    });
    // App title/name lives on the app detail query.
    queryClient.invalidateQueries({
      queryKey: [BoardScopedQuery.LIST_MY_APPS, appId],
    });
    // Reload the manifest buffers (if open) as an external change.
    track(
      'refresh manifest',
      refreshFileContents([APP_YAML_PATH, SKETCH_YAML_PATH], 'external-change'),
    );
  }, [appId, queryClient, refreshFileContents]);

  // Subscribe to backend refresh events. Kept stable across tab changes.
  useEffect(() => {
    const unsubscribe = onWatcherRefresh((event) => {
      switch (event.kind) {
        case 'file': {
          // Reload the buffer if the file is open in a tab; the in-place
          // override makes CodeMirror reload a *visible* file via its
          // instanceId change, and that reload re-syncs the LS as a side
          // effect.
          const fileId = openAbsPathsRef.current.get(event.path);
          if (fileId && !keepMovedBuffer(fileId)) {
            track(
              'refresh content',
              refreshFileContents([fileId], 'external-change'),
            );
          }
          // Surgically sync the LS's in-memory copy unless the file is shown
          // in a panel (a live view re-syncs through the reload above; the
          // call no-ops for it). This must ALSO run for open-but-BACKGROUND
          // tabs: they have no editor view, so nothing else tells the LS
          // until the tab is selected — and by then the Arduino LS may have
          // picked the new content up from disk on its own (it re-reads the
          // sketch when it rebuilds), so the deferred tab-selection diff
          // would apply ON TOP of it, corrupting the server copy (the
          // `gd` → `god` → `good` phantom-symbol bug). No-op when LSP is
          // disabled or the file isn't LS-tracked (announces a disk change
          // instead).
          const reloadLspFile = reloadLspFileRef.current;
          if (reloadLspFile) {
            track(
              'reload lsp file',
              reloadLspFile(toAppRelativeId(event.path, appPath)),
            );
          }
          break;
        }
        case 'dir': {
          const relPath = toAppRelativeId(event.path, appPath);
          // A removal must reconcile open tabs, not just refetch the tree —
          // otherwise a removed file's tab lingers as a ghost (its id survives
          // while its meta vanishes from the refetched tree). Close the removed
          // path and everything under it (covers a folder removal/move, whose
          // descendants get no events of their own) in BOTH panels, keyed off
          // the live open-tab set. Routed through deleteFile with
          // `source: 'stream'` so the coded UI side effects run without
          // re-issuing the backend delete (it already happened on disk).
          if (event.op === 'remove') {
            // A folder that goes away must stop being listed, so one that comes
            // back under the same name (a rename arrives as remove + create)
            // starts unlisted instead of showing the old contents.
            unlistDir(relPath);
            openIdsRef.current
              .filter((id) => id === relPath || id.startsWith(`${relPath}/`))
              .forEach((id) =>
                track(
                  'stream remove',
                  deleteFileRef.current(id, { source: 'stream' }),
                ),
              );
          }
          // Reconcile the LS with the structural change so cross-file
          // resolution recovers like a UI op. An external move arrives as
          // remove(old) + create(new) the backend can't correlate, so each half
          // is handled independently (the create half lands the moved doc in
          // the refetched tree below). No-op when LSP is disabled.
          if (event.op === 'remove' || event.op === 'create') {
            syncLspWatchedChangeRef.current?.(relPath, event.op);
          }
          // A create can carry new CONTENT, not just structure: an editor's
          // atomic save (write temp + rename) coalesces in the watcher's
          // debouncer into a bare create, and a moved-in file arrives with its
          // content. Reconcile it like a `file` event — reload the buffer if
          // the path is an open tab, and surgically sync the LS copy (no-op
          // for live views and folders; a file the create just tracked diffs
          // to nothing, and reloadLspFile awaits that tracking so the two
          // can't race). Without this, an atomic save to a tracked file only
          // announced the path and the server kept serving the didOpen'd
          // stale buffer until app restart.
          if (event.op === 'create') {
            // A directory replaced in one step (`mv sub sub_moved && mkdir
            // sub`) coalesces in the backend's per-path debounce into this
            // single create, so a folder the tree is showing may now hold
            // something else entirely. No-op unless the path is a listed
            // directory, which a plain file create never is.
            relistDir(relPath);
            const fileId = openAbsPathsRef.current.get(event.path);
            // A polling watcher reports each file of a folder the agent moved as created.
            if (fileId && !keepMovedBuffer(fileId)) {
              track(
                'refresh content',
                refreshFileContents([fileId], 'external-change'),
              );
            }
            const reloadLspFile = reloadLspFileRef.current;
            if (reloadLspFile) {
              track('reload lsp file', reloadLspFile(relPath));
            }
          }
          // Refetch so the tree reflects the change (create/write, or a removal
          // with nothing open under it) — deleteFile's own invalidation covers
          // the closed tabs; this covers everything else.
          const dir = parentDir(relPath);
          queryClient.invalidateQueries({
            queryKey: appDirKey(appId, dir),
            exact: true,
          });
          // The default file is picked from the root's own entries, so it is
          // only the root that can change the answer.
          if (dir === '') {
            queryClient.invalidateQueries({
              queryKey: [BoardScopedQuery.APP_DEFAULT_FILE, appId],
            });
          }
          break;
        }
        case 'manifest':
          invalidateManifest();
          break;
        case 'apps':
          // Handled by the app-list page (see appList.logic).
          break;
      }
    });

    return () => unsubscribe();
  }, [
    appId,
    appPath,
    queryClient,
    refreshFileContents,
    invalidateManifest,
    unlistDir,
    relistDir,
  ]);

  // One recursive watch on the app covers file content, tree, and manifests.
  useEffect(() => {
    if (!appPath) return;

    track('watch app', watchApp(appPath));

    return () => {
      track('unwatch app', unwatchApp(appPath));
    };
    // connectedBoardCacheId: re-watch on board switch (see above).
  }, [appPath, connectedBoardCacheId]);
}
