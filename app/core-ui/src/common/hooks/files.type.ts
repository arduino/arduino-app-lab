import {
  FileId,
  RetrieveFileContentsResult,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { Subject } from 'rxjs';

import { OpenFilesStoreItem, OpenFilesStorePatch } from './files';

export interface BasicFileData {
  name: string;
  fullName: string;
  path: string;
  extension: string;
}

export interface BrickFileData {
  name: string;
  id: string;
  category: string;
}

export type BasicFilesData = BasicFileData[];

export type UseFiles = (args: {
  mainFile?: RetrieveFileContentsResult | BasicFileData;
  bricks?: BrickFileData[];
  files?: RetrieveFileContentsResult[] | BasicFilesData;
  defaultFilePath?: string;
  filesAreLoading?: boolean;
  filesContentLoaded?: boolean;
  isLibraryRoute?: boolean;
  showSketchSecretsFile?: boolean;
  storeEntityId?: string;
  getUnsavedFilesSubject: () => Subject<Set<FileId>>;
  autoOpenedFiles?: string[];
  isClassicSketch?: boolean;
}) => {
  mainFile?: SelectableFileData;
  editorFiles: SelectableFileData[];
  selectedFile: SelectableFileData | undefined;
  openFiles: SelectableFileData[];
  unsavedFileIds: Set<string> | undefined;
  openFilesStore?: OpenFilesStoreItem | null;
  previewFileId?: string;
  selectFile: (params: {
    fileId?: string;
    openAtIndex?: number;
    isPreview?: boolean;
  }) => void;
  closeFile: (fileId: string) => void;
  updateOpenFile: (prevFileId: string, nextFileId: string) => void;
  updateOpenFilesOrder: (fileIds: string[], draggedFileId?: string) => void;
  onSketchRename: (newName: string) => void;
  onAppRename: (newAppId: string) => void;
  storeSplitState: (patch: OpenFilesStorePatch) => Promise<void>;
};
