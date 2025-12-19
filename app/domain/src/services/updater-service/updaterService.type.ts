import {
  EventSourceHandlers,
  MandatoryUpdateList,
  UpdateCheckResult,
} from '@cloud-editor-mono/infrastructure';

export interface UpdaterService {
  newVersion(): Promise<string>;
  getCurrentVersion(): Promise<string>;
  checkAndApplyUpdate(): Promise<void>;
  checkBoardUpdateWailsFallback(boardUrl: string): Promise<UpdateCheckResult>;
  applyBoardUpdateWailsFallback(boardUrl: string): Promise<boolean | null>;
  getBoardUpdateLogsWailsFallback(
    boardUrl: string,
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  getMandatoryUpdatesList?: () => Promise<MandatoryUpdateList>;
}
