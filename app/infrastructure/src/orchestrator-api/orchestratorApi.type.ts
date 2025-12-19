import { components, operations } from './orchestrator-api';

// models
export type AppInfo = components['schemas']['AppInfo'];
export type AppDetailedInfo = components['schemas']['AppDetailedInfo'];
export type AppDetailedBrick = components['schemas']['AppDetailedBrick'];
export type AppStatus = components['schemas']['Status'];
export type UpdateAppDetailRequest = components['schemas']['EditRequest'];
export type CloneAppRequest = components['schemas']['CloneRequest'];
export type CloneAppResult = components['schemas']['CloneAppResponse'];
export type CreateAppRequest = components['schemas']['CreateAppRequest'];
export type CreateAppResult = components['schemas']['CreateAppResponse'];

export type ConfigDirs = components['schemas']['ConfigDirectories'];

export type BrickInstance = components['schemas']['BrickInstance'];
export type BrickListItem = components['schemas']['BrickListItem'];
export type BrickDetails = components['schemas']['BrickDetailsResult'];
export type BrickCreateUpdateRequest =
  components['schemas']['BrickCreateUpdateRequest'];
export type BrickConfigVariable = components['schemas']['BrickConfigVariable'];
export type BrickVariable = components['schemas']['BrickVariable'];
export type BrickModel = components['schemas']['AIModel'];

export type AppPort = components['schemas']['Port'];

export type SystemPropertyKeysResponse =
  components['schemas']['PropertyKeysResponse'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SystemPropertyValue = any;

export type SketchLibrary = components['schemas']['Library'];

export type Pagination = components['schemas']['Pagination'];

// operations
export type ListAppParams = operations['getApps']['parameters'];
export type ListAppResult = components['schemas']['AppListResponse'];
export type ListAppBrickInstancesResult =
  components['schemas']['AppBrickInstancesResult'];
export type ListAppPortsResult = components['schemas']['AppPortResponse'];

export type GetConfigResult = components['schemas']['ConfigResponse'];

export type ListBrickResult = components['schemas']['BrickListResult'];

export type UpdateCheckResult = components['schemas']['UpdateCheckResult'];

export type ListLibrariesParams = operations['listLibraries']['parameters'];
export type LibraryListResponse = components['schemas']['LibraryListResponse'];

// others
export interface AppConfig {
  directories?: ConfigDirs;
}

export enum StreamEventType {
  App = 'app',
  Message = 'message',
  Error = 'error',
  Progress = 'progress',
}

export interface MessageData {
  id: string;
  message: string;
}

export interface ErrorData {
  code: string;
  message?: string;
}

interface ProgressData {
  progress: number;
}

export type StreamEvent =
  | { event: StreamEventType.App; data: AppDetailedInfo }
  | { event: StreamEventType.Message; data: MessageData }
  | { event: StreamEventType.Error; data: ErrorData }
  | { event: StreamEventType.Progress; data: ProgressData };

export enum SystemResourcesStreamMessageType {
  Cpu = 'cpu',
  Memory = 'mem',
  Disk = 'disk',
  Error = 'error',
}

export type BoardUpdateLogEvent =
  | 'starting'
  | 'log'
  | 'restarting'
  | 'done'
  | 'close'
  | 'error';

export interface BoardUpdateLog {
  data: string;
  event: BoardUpdateLogEvent;
}

export interface Version {
  version: string;
}
