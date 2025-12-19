import { CamelCasedProperties } from 'type-fest';

import {
  ArduinoBuilderExtrafile,
  ArduinoBuilderExtrafileV2,
  ArduinoBuilderFile,
} from './builderApi.type';

export type filefull_BuilderApi = Required<
  Pick<ArduinoBuilderFile, 'data' | 'name'>
>;

export function isBuilderSketchFileFull(data: {
  data?: unknown;
  name?: unknown;
}): data is filefull_BuilderApi {
  return Boolean(
    typeof data.data !== 'undefined' && typeof data.name === 'string',
  );
}

interface pinned_lib_BuilderApi {
  name?: string;
  version?: string;
}

interface sketch_BuilderApi {
  files?: filefull_BuilderApi[];
  ino?: filefull_BuilderApi;
  metadata?: {
    included_libs: pinned_lib_BuilderApi[];
  };
  name?: string;
}

export interface compilation_BuilderApi {
  fqbn: string;
  ota?: boolean;
  path?: string;
  sketch?: sketch_BuilderApi;
  verbose?: boolean;
}

export type CompileSketch_Body = compilation_BuilderApi;

export interface ArduinoBuilderCompilationResult_BuilderApi {
  bin?: string;
  bin_url?: string;
  elf?: string;
  elf_url?: string;
  files?: ArduinoBuilderExtrafile[];
  hex?: string;
  hex_url?: string;
  ota_key?: string;
  stderr?: string;
  stdout?: string;
}

export type CompileSketch_Response =
  CamelCasedProperties<ArduinoBuilderCompilationResult_BuilderApi>;

export type UsableCompileSketch_Response =
  | {
      stderr: string;
      stdout?: string;
    }
  | {
      stderr?: string;
      stdout: string;
    };

export interface ArduinoBuilderV2CompilationsResponse_BuilderApi {
  id: string;
  status: 'created' | 'running' | 'cancelled' | 'failed' | 'completed';
}

export interface ArduinoBuilderV2CancelCompilation_Params {
  id: string;
}
export interface ArduinoBuilderV2CompilationStream_Params {
  id: string;
}

export interface ArduinoBuilderV2CompilationOutputResponse_BuilderApi {
  name: string;
  bin?: string;
  hex?: string;
  elf?: string;
  ota_key?: string;
  extra_files?: ArduinoBuilderExtrafileV2[];
  files?: ArduinoBuilderExtrafileV2[];
}

export type CompilationOutput_Response =
  CamelCasedProperties<ArduinoBuilderV2CompilationOutputResponse_BuilderApi>;
export interface ArduinoBuilderV2CompilationOutput_Params {
  id: string;
  type?: 'bin' | 'hex' | 'elf';
}

export enum CompilationStreamMessageType {
  Stdout = 'stdout',
  Stderr = 'stderr',
  Status = 'status',
  Progress = 'progress',
  Result = 'result',
}
