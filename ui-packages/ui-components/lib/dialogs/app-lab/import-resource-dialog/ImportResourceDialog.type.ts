import { TreeNode } from '../../../file-tree';
import { OnDuplicateConflictParams } from '../duplicate-file-dialog/types';

export interface ImportResourceResult {
  id: string;
  name: string;
}

export enum ImportStatus {
  Idle = 'idle',
  Uploading = 'uploading',
  UploadFailed = 'upload-failed',
}

export type ResourceType = 'app' | 'file' | 'folder';

export type UseImportResourceProps = {
  importResourceDialogOpen: boolean;
  setImportResourceDialogOpen: (open: boolean) => void;
  setImportedResourceId: (id: string | undefined) => void;
  importResourceFromPath: (
    filePath: string,
    isFolder: boolean,
    newFileName?: string,
  ) => Promise<ImportResourceResult>;
  type: ResourceType;
  invalidateQueries: () => void;
  nodes?: TreeNode[];
  targetFolderPath?: string;
  onDuplicateConflict?: (params: OnDuplicateConflictParams) => void;
  selectResourcePath?: () => Promise<string | string[] | null>;
};

export interface ImportResourceDialogProps {
  logic: ImportResourceLogic;
}

export type ImportResourceLogic = () => {
  open: boolean;
  status: ImportStatus;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  startImport: (remoteDir?: string) => void;
  type: ResourceType;
};
