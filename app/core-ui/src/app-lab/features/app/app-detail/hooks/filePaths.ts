import {
  OpenFilesStoreItem,
  OpenFilesStorePanelState,
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

export const parentDir = (path: string): string =>
  path.split('/').slice(0, -1).join('/');

export const resolveAbsPath = (id: string, appPath?: string): string =>
  isAbsoluteId(id) ? id : `${appPath ?? ''}/${id}`;

// Inverse of resolveAbsPath: turn an absolute watcher path back into the
// app-relative id used by the file tree / open tabs. Paths outside the app
// (or with no appPath) are returned unchanged.
export const toAppRelativeId = (absPath: string, appPath?: string): string =>
  appPath && absPath.startsWith(`${appPath}/`)
    ? absPath.slice(appPath.length + 1)
    : absPath;

type DropId = (id: string) => boolean;

const dropKeys = <T>(
  byFileId: Record<string, T> | undefined,
  drop: DropId,
): Record<string, T> | undefined =>
  byFileId &&
  Object.fromEntries(Object.entries(byFileId).filter(([id]) => !drop(id)));

const panelWithoutIds = (
  panel: OpenFilesStorePanelState,
  drop: DropId,
): OpenFilesStorePanelState => ({
  ...panel,
  items: panel.items.filter((id) => !drop(id)),
  selected: panel.selected && drop(panel.selected) ? null : panel.selected,
  markdownByFileId: dropKeys(panel.markdownByFileId, drop),
  brickTabByFileId: dropKeys(panel.brickTabByFileId, drop),
});

export const withoutIds = (
  item: OpenFilesStoreItem,
  drop: DropId,
): OpenFilesStoreItem => ({
  ...item,
  items: item.items.filter((id) => !drop(id)),
  selected: item.selected && drop(item.selected) ? null : item.selected,
  previewFileId:
    item.previewFileId && drop(item.previewFileId) ? null : item.previewFileId,
  panes: item.panes && {
    A: panelWithoutIds(item.panes.A, drop),
    B: item.panes.B && panelWithoutIds(item.panes.B, drop),
  },
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
): OpenFilesStoreItem => withoutIds(item, isHostLocalId);
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
