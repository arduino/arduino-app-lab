import { FileIcon } from '@cloud-editor-mono/images/assets/file-icons';
import { BrickInstance } from '@cloud-editor-mono/infrastructure';
import {
  BRICK_FILE_EXTENSION,
  BrickIcon,
  FileNode,
  SelectableFileData,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { sortBy } from 'lodash';
import { useMemo, useRef } from 'react';

type MetaCacheEntry = { key: string; meta: SelectableFileData };

// Builds the tab-meta catalogue (project files + bricks + external files)
// and caches each SelectableFileData per fileId so unchanged ids return
// the SAME reference across rebuilds. Identity stability matters because
// the editor panel memo and a few effects depend on the selected file's
// object identity — without the cache, an unrelated file's content edit
// would re-create every tab-meta object.
//
// External files are identified by an absolute path id (leading `/` for
// onboard files, or `file://` for host-machine files). Their meta is
// derived from the path itself and marked read-only.
export function useEditorFileMeta(
  filesList: FileNode[] | undefined,
  appBricks: BrickInstance[] | undefined,
  externalPaths: string[] | undefined,
): Map<string, SelectableFileData> {
  const cacheRef = useRef<Map<string, MetaCacheEntry>>(new Map());

  return useMemo(() => {
    const next = new Map<string, SelectableFileData>();

    const sortedFiles = sortBy(filesList ?? [], (f) => f.name.toLowerCase());
    for (const file of sortedFiles) {
      const id = file.path;
      const fullName = file.name;
      const ext = file.extension.replace('.', '');
      const baseName = fullName.includes('.')
        ? fullName.split('.').slice(0, -1).join('.')
        : fullName;
      const key = `file|${id}|${fullName}|${baseName}|${ext}`;
      const prev = cacheRef.current.get(id);
      if (prev && prev.key === key) {
        next.set(id, prev.meta);
      } else {
        const meta: SelectableFileData = {
          fileId: id,
          fileFullName: fullName,
          fileName: baseName,
          fileExtension: ext,
          Icon: <FileIcon fileName={fullName} />,
          tags: [],
        };
        next.set(id, meta);
        cacheRef.current.set(id, { key, meta });
      }
    }

    for (const brick of appBricks ?? []) {
      const id = brick.id ?? '';
      const name = brick.name ?? '';
      const category = brick.category ?? '';
      const key = `brick|${id}|${name}|${category}`;
      const prev = cacheRef.current.get(id);
      if (prev && prev.key === key) {
        next.set(id, prev.meta);
      } else {
        const meta: SelectableFileData = {
          fileId: id,
          fileName: name,
          fileFullName: name,
          fileExtension: BRICK_FILE_EXTENSION,
          Icon: <BrickIcon category={category} size="xsmall" />,
          tags: [],
        };
        next.set(id, meta);
        cacheRef.current.set(id, { key, meta });
      }
    }

    for (const path of externalPaths ?? []) {
      const fullName = path.split('/').pop() ?? path;
      const baseName = fullName.includes('.')
        ? fullName.split('.').slice(0, -1).join('.')
        : fullName;
      const ext = fullName.includes('.') ? fullName.split('.').pop() ?? '' : '';
      const key = `external|${path}|${fullName}|${baseName}|${ext}`;
      const prev = cacheRef.current.get(path);
      if (prev && prev.key === key) {
        next.set(path, prev.meta);
      } else {
        const meta: SelectableFileData = {
          fileId: path,
          fileFullName: fullName,
          fileName: baseName,
          fileExtension: ext,
          Icon: <FileIcon fileName={fullName} />,
          tags: [],
          isMetadataReadOnly: true,
        };
        next.set(path, meta);
        cacheRef.current.set(path, { key, meta });
      }
    }

    // Drop entries for ids that are no longer present in any input,
    // so the cache size tracks the live set instead of growing
    // monotonically as files/bricks/external paths come and go.
    for (const id of cacheRef.current.keys()) {
      if (!next.has(id)) cacheRef.current.delete(id);
    }

    return next;
  }, [filesList, appBricks, externalPaths]);
}
