export enum UpdaterStatus {
  None = 'None',
  Checking = 'Checking',
  CheckingFailed = 'CheckingFailed',
  AlreadyUpToDate = 'AlreadyUpToDate',
  UpdateAvailable = 'UpdateAvailable',
  UpdatingBoard = 'UpdatingBoard',
  UpdatingApp = 'UpdatingApp',
  UpdateFailed = 'UpdateFailed',
  UpdateComplete = 'UpdateComplete',
  Restarting = 'Restarting',
  Skipped = 'Skipped',
}

export type BoardUpdateDialogLogic = () => {
  open: boolean;
  isBoard: boolean | undefined;
  status: UpdaterStatus;
  title?: string;
  newAppVersion?: string;
  boardUpdateSucceeded?: boolean;
  appUpdateSucceeded?: boolean;
  boardUpdates?: Array<{ name: string; toVersion: string }> | null;
  boardLogs?: string[];
  boardLogErrors?: Array<{ code: string; message: string }>;
  logStatus?: 'failed' | 'success' | 'pending';
  startUpdate: () => void;
  reloadApp: () => void;
  openFlasherTool: () => Promise<void>;
  openArduinoSupport: () => Promise<void>;
  skipUpdate: () => void;
  bypassSkipUpdate: boolean;
};

export type BoardUpdateDialogProps = { logic: BoardUpdateDialogLogic };
