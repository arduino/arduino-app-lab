import {
  FileId,
  RetrieveFileContentsResult,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { Subject } from 'rxjs';

export interface BasicFileData {
  name: string;
  fullName: string;
  path: string;
  extension: string;
}

export interface BrickFileData {
  name: string;
  id: string;
}

export type BasicFilesData = BasicFileData[];

export type UseFiles = (args: {
  mainFile?: RetrieveFileContentsResult | BasicFileData;
  bricks?: BrickFileData[];
  files?: RetrieveFileContentsResult[] | BasicFilesData;
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
  storedOpenFileNames: string[] | undefined | null;
  selectFile: (fileId?: string, openAtIndex?: number) => void;
  closeFile: (fileId: string) => void;
  updateOpenFile: (prevFileId: string, nextFileId: string) => void;
  updateOpenFilesOrder: (fileIds: string[]) => void;
  onSketchRename: (newName: string) => void;
};
