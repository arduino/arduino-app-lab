import { CamelCasedProperties } from 'type-fest';

export interface sketchv2secret_CreateApi {
  name: string;
  value?: string;
}

export type SketchSecrets = sketchv2secret_CreateApi[];

interface sketchv2lib_CreateApi {
  name?: string;
  path?: string;
  properties?: {
    sentence: string;
    url: string;
    maintainer: string;
  };
  version?: string;
  id?: string;
  user_id?: string;
  examples_children?: number;
}

type SketchLibs = sketchv2lib_CreateApi[];

export type Libs_CreateApi = sketchv2lib_CreateApi[];

interface BaseSketchV2Model_CreateApi {
  board_fqbn?: string;
  board_name?: string;
  board_type?: string;
  ino?: string;
  is_public?: boolean;
  libraries?: SketchLibs;
  path?: string;
  secrets?: SketchSecrets;
  size?: number;
  thing_id?: string;
  tutorials?: string[];
  types?: string[];
  user_id?: string;
  organization_id?: string;
} // TODO check origin of this type

type OptionalCreatedSketchProps =
  | 'secrets'
  | 'size'
  | 'thing_id'
  | 'ino'
  | 'organization_id';
export type ArduinoCreateSketchV2_CreateApi = {
  href: string;
  id: string;
  created_at: string;
  modified_at: string;
  name: string;
} & Required<Omit<BaseSketchV2Model_CreateApi, OptionalCreatedSketchProps>> &
  Pick<BaseSketchV2Model_CreateApi, OptionalCreatedSketchProps>;

export interface ArduinoCreateSketchesV2_CreateApi {
  next?: string;
  prev?: string;
  sketches: ArduinoCreateSketchV2_CreateApi[];
}

interface SketchInfoV1_CreateApi {
  id: string;
  is_public: boolean;
  thing_id?: string;
}

interface FileV2_CreateApi {
  children?: number;
  href: string;
  mimetype?: string;
  modified_at: string;
  name: string;
  path: string;
  size?: number;
  revision?: GetFileHash_CreateApi;
  sketch_info?: SketchInfoV1_CreateApi;
  type: 'file' | 'sketch' | 'folder';
}

export type FileContentV2_CreateApi = { data?: string } & Required<
  Pick<
    FileV2_CreateApi,
    'href' | 'mimetype' | 'modified_at' | 'path' | 'revision'
  >
>;

export type FileV2List_CreateApi = FileV2_CreateApi[];

export interface FileContentV2Write_CreateApi {
  bytes: number;
  bytes_b64: number;
  hash?: string;
}

export interface FileV2Delete_CreateApi {
  status?: string;
}

export interface EditSketchesV2Payload_CreateApi {
  board_fqbn?: string;
  board_name?: string;
  board_type?: string;
  ino?: string;
  is_public?: boolean;
  libraries: SketchLibs;
  path?: string;
  secrets?: { data?: SketchSecrets };
  thing_id: string;
  tutorials?: string[];
  types?: string[];
  user_id?: string | 'me';
}

export type CreateSketch_Body = Required<
  Pick<EditSketchesV2Payload_CreateApi, 'user_id' | 'path' | 'ino'>
>;

export interface GetSketch_Params {
  id: string;
}

export interface DeleteSketch_Params {
  id: string;
}

export interface GetSketches_Params {
  user_id: string;
  name_like?: string;
}

export interface FileChange_Params {
  path: string;
}

export type SketchData = CamelCasedProperties<
  Omit<ArduinoCreateSketchV2_CreateApi, 'board_fqbn'>
> & { fqbn: ArduinoCreateSketchV2_CreateApi['board_fqbn'] };

export type CreateSketch_Response = SketchData;

export type GetSketch_Response = SketchData;

export type GetSketches_Response = GetSketch_Response[];

type GetFile_Response = CamelCasedProperties<
  Pick<FileV2_CreateApi, 'href' | 'modified_at' | 'path'> &
    Partial<Pick<FileV2_CreateApi, 'mimetype'>> & {
      revision?: GetFileHash_Response;
    }
>;

export type GetFile_ResponseWithName = GetFile_Response & {
  name: FileV2_CreateApi['name'];
  type: FileV2_CreateApi['type'];
  children?: FileV2_CreateApi['children'];
};

export type GetFilesList_Response = GetFile_ResponseWithName[];

export type GetFile_ResponseWithContents = GetFile_Response & {
  data?: FileContentV2_CreateApi['data'];
};

export type GetFileContents_Response = GetFile_ResponseWithContents;

type WriteSketchFile_Response =
  CamelCasedProperties<FileContentV2Write_CreateApi>;
export interface PostSketchFile_Body {
  data: string;
  hash?: string;
}

export type PostSketchFile_Response = WriteSketchFile_Response;

export interface RenameSketch_Body {
  from: string;
  to: string;
}

export interface DeleteSketchFile_Response {
  status: FileV2Delete_CreateApi['status'];
}

export interface GetLibrary_Response {
  name?: string;
  path?: string;
  properties?: {
    sentence: string;
    url: string;
    maintainer: string;
  };
  id?: string;
  userId?: string;
}

export type GetCustomLibrary_Response = {
  code?: string;
  id: string;
  examplesChildren?: number;
  __versionForDownload?: string;
  __releaseId?: string;
} & GetLibrary_Response;

export type GetLibrariesList_Response = GetCustomLibrary_Response[];

export type PostLibrary_Body = Blob;

export interface GetLibraryCode_Params {
  id: string;
}

export interface GetLibraryCode_Response {
  code: string;
}

export interface ArduinoCreateUser_CreateApi {
  activated?: string;
  created?: string;
  email?: string;
  id?: string;
  limits?: ArduinoCreateUserLimits_CreateApi;
  prefs?: ArduinoCreateUserPrefs_CreateApi;
  username?: string;
}

interface ArduinoCreateUserLimits_CreateApi {
  compilations: number;
  disk: number;
  sketches: number;
}

interface ArduinoCreateUserPrefs_CreateApi {
  autosave?: boolean;
  font_size?: number;
  hide_panel?: boolean;
  save_on_build?: boolean;
  show_all_content?: boolean;
  skin?: string;
  verbose?: boolean;
  verbose_always_visible?: boolean;
  walkthrough_off?: boolean;
}

export type CreateUser_Response =
  CamelCasedProperties<ArduinoCreateUser_CreateApi>;

export interface GetFileHash_Params {
  path: string;
}

export interface GetFileHash_CreateApi {
  filename: string;
  hash?: string;
  modified_at: string;
  username: string;
}

export type GetFileHash_Response = CamelCasedProperties<GetFileHash_CreateApi>;
