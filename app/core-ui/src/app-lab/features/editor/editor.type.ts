import {
  BrickCreateUpdateRequest,
  BrickInstance,
} from '@cloud-editor-mono/infrastructure';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface EditorLogicParams {
  appPath?: string;
  appBricks?: BrickInstance[];
  selectedFile?: SelectableFileData;
  selectFile: (fileId?: string, openAtIndex?: number) => void;
  selectableMainFile?: SelectableFileData;
  unsavedFileIds?: Set<string>;
  closeFile: (fileId: string) => void;
  updateOpenFilesOrder: (fileIds: string[]) => void;
  deleteAppFile: (path: string) => Promise<void>;
  renameAppFile: (path: string, newName: string) => Promise<void>;
  addAppFile: (
    path: string,
    fileName: string,
    fileExtension: string,
  ) => Promise<void>;
  initialAppBrickTab?: string;
  updateAppBrick: (
    brickId: string,
    params: BrickCreateUpdateRequest,
  ) => Promise<boolean>;
  sketchDataIsLoading: boolean;
  openFiles: SelectableFileData[];
  readOnly: boolean;
}
