import {
  OpenFilesStoreItem,
  OpenFilesStorePaneState,
} from '../../../../../common/hooks/files';

// Helpers for App Lab file ids.
//
// Id taxonomy:
// - app-relative (`app.yaml`, `temp/note.txt`): resolved against `appPath`
// - onboard absolute (`/apps/other/foo.py`): file on the board; part of the
//   project iff it starts with `appPath`
// - host-local (`file:///Users/me/scratch.md`): file on the machine, loaded
//   from the local FS on the Go side

export const isAbsoluteId = (id: string): boolean =>
  id.startsWith('/') || id.startsWith('file://');

export const isHostLocalId = (id: string): boolean => id.startsWith('file://');

export const resolveAbsPath = (id: string, appPath?: string): string =>
  isAbsoluteId(id) ? id : `${appPath ?? ''}/${id}`;

// Inverse of resolveAbsPath: turn an absolute watcher path back into the
// app-relative id used by the file tree / open tabs. Paths outside the app
// (or with no appPath) are returned unchanged.
export const toAppRelativeId = (absPath: string, appPath?: string): string =>
  appPath && absPath.startsWith(`${appPath}/`)
    ? absPath.slice(appPath.length + 1)
    : absPath;

const withoutHostLocal = (ids: string[]): string[] =>
  ids.filter((id) => !isHostLocalId(id));

const dropHostLocalKeys = <T>(
  byFileId: Record<string, T> | undefined,
): Record<string, T> | undefined =>
  byFileId &&
  Object.fromEntries(
    Object.entries(byFileId).filter(([id]) => !isHostLocalId(id)),
  );

const paneWithoutHostLocalIds = (
  pane: OpenFilesStorePaneState,
): OpenFilesStorePaneState => ({
  ...pane,
  items: withoutHostLocal(pane.items),
  selected:
    pane.selected && isHostLocalId(pane.selected) ? null : pane.selected,
  markdownByFileId: dropHostLocalKeys(pane.markdownByFileId),
  brickTabByFileId: dropHostLocalKeys(pane.brickTabByFileId),
});

/**
 * Strips host-local (`file://`) ids from a persisted open-tabs record.
 *
 * Host files are deliberately not remembered across launches. This store lives
 * in IndexedDB, which the renderer can write, so a `file://` id read back at
 * startup would be a host-file read with nothing but stored state behind it —
 * the backend refuses those (see `internal/hostread`), and restoring the tab
 * anyway would only produce one that cannot load. Applied on the way in and on
 * the way out, so records written before this rule are ignored too.
 */
export const withoutHostLocalIds = (
  item: OpenFilesStoreItem,
): OpenFilesStoreItem => ({
  ...item,
  items: withoutHostLocal(item.items),
  selected:
    item.selected && isHostLocalId(item.selected) ? null : item.selected,
  previewFileId:
    item.previewFileId && isHostLocalId(item.previewFileId)
      ? null
      : item.previewFileId,
  panes: item.panes && {
    A: paneWithoutHostLocalIds(item.panes.A),
    B: item.panes.B && paneWithoutHostLocalIds(item.panes.B),
  },
});
/**
 * Split a file's display name into base name and extension.
 *
 * Only the LAST dot separates, so `notes.tar.gz` is `notes.tar` + `gz`. A
 * leading dot belongs to the name: `.gitignore` is named `.gitignore` and has
 * no extension. (The file tree disagrees — Go's `path.Ext('.gitignore')`
 * returns `.gitignore` — so prefer this when reasoning about a *name*.)
 *
 * Pass a bare name, not a path: a path may contain dots in its directories.
 */
export const splitFileName = (
  fullName: string,
): { fileName: string; fileExtension: string } => {
  const dotIndex = fullName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { fileName: fullName, fileExtension: '' };
  }
  return {
    fileName: fullName.slice(0, dotIndex),
    fileExtension: fullName.slice(dotIndex + 1),
  };
};
