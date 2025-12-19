import {
  AppConfig,
  AppDetailedInfo,
  AppInfo,
  AppPort,
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickInstance,
  BrickListItem,
  CloneAppRequest,
  CreateAppRequest,
  EventSourceHandlers,
  LibraryListResponse,
  ListAppParams,
  ListLibrariesParams,
  SystemPropertyValue,
  UpdateAppDetailRequest,
  UpdateCheckResult,
  WebSocketHandlers,
} from '@cloud-editor-mono/infrastructure';
import { TreeNode } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface OrchestratorService {
  getApps(params: ListAppParams): Promise<AppInfo[]>;
  getAppsStatus(
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  getAppDetail(id: string): Promise<AppDetailedInfo>;
  updateAppDetail(
    id: string,
    body: UpdateAppDetailRequest,
  ): Promise<string | undefined>;
  createApp(body: CreateAppRequest): Promise<string | undefined>;
  cloneApp(id: string, body?: CloneAppRequest): Promise<string | undefined>;
  deleteApp(id: string): Promise<boolean>;
  getFiles(path: string): Promise<TreeNode[]>;
  getFileContent(path: string): Promise<string>;
  startApp(
    id: string,
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  stopApp(
    id: string,
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  getAppLogs(
    id: string,
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  getSerialMonitorLogs(handlers: WebSocketHandlers): Promise<WebSocket>;
  getAppPorts(id: string): Promise<AppPort[]>;
  getAppBricks(id: string, params?: never): Promise<BrickInstance[]>;
  getAppBrickInstance(appId: string, brickId: string): Promise<BrickInstance>;
  addAppBrick(
    appId: string,
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  deleteAppBrick(appId: string, brickId: string): Promise<boolean>;
  updateAppBrick(
    appId: string,
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean>;
  getBricks(): Promise<BrickListItem[]>;
  getBrickDetails(id: string): Promise<BrickDetails>;
  getConfig(): Promise<AppConfig>;
  getSystemResources(
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  checkBoardUpdate(onlyArduino: boolean): Promise<UpdateCheckResult>;
  getBoardUpdateLogs(
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void>;
  applyBoardUpdate(onlyArduino: boolean): Promise<boolean | null>;
  getVersion(): Promise<string>;
  getSystemPropertyKeys(): Promise<string[]>;
  getSystemProperty(key: string): Promise<SystemPropertyValue>;
  upsertSystemProperty(
    key: string,
    value: string,
  ): Promise<SystemPropertyValue>;
  deleteSystemProperty(key: string): Promise<SystemPropertyValue>;
  getSketchLibraries(params: ListLibrariesParams): Promise<LibraryListResponse>;
  getAppSketchLibraries(appId: string): Promise<{ libraries: string[] }>;
  addAppSketchLibrary(appId: string, libRef: string): Promise<void>;
  deleteAppSketchLibrary(appId: string, libRef: string): Promise<void>;
}
