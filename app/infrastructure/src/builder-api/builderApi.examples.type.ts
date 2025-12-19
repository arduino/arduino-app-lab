import { ArduinoBuilderFile } from './builderApi.type';

export interface GetExamples_Params {
  maintainer?: string;
  type?: string;
}

export interface GetExamples_Response {
  examples: ArduinoBuilderExample_BuilderApi[];
}

export interface GetExampleFileContents_Params {
  path: string;
}

export type ArduinoBuilderExampleFile_BuilderApi = Pick<
  ArduinoBuilderFile,
  'name' | 'href' | 'mimetype' | 'path' | 'data'
>;

export type GetExampleFileContents_Response =
  ArduinoBuilderExampleFile_BuilderApi;

export interface ArduinoBuilderExample_BuilderApi {
  name?: string;
  path?: string;
}

export type ArduinoBuilderLibraryFile_BuilderApi = ArduinoBuilderFile;

export interface BuiltinExampleFile {
  name: string;
  path: string;
  mimetype: string;
  data?: string; // base64
  href?: string;
  last_modified?: string;
}

export interface BuiltinExampleDetailResponse {
  files: BuiltinExampleFile[];
}

export interface BuiltinExampleBase {
  name: string;
  path: string;
  folder?: string;
}

export interface BuiltinExampleDetailResponse {
  files: BuiltinExampleFile[];
}

export interface BuiltinExampleListResponse {
  examples: BuiltinExampleBase[];
}

export type CompleteBuiltinExample = BuiltinExampleBase & {
  files?: BuiltinExampleFile[];
  ino?: BuiltinExampleFile;
};
