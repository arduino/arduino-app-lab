import { ArduinoBuilderExtrafile } from './builderApi.type';

export interface GetBoardsByVidPid_Params {
  vid: string;
  pid: string;
}

export interface GetBoardByFqbn_Params {
  fqbn: string;
}

export interface ArduinoBuilderBoardMenuVariantv3_BuilderApi {
  id: string;
  name: string;
}

export interface ArduinoBuilderBoardMenuv3_BuilderApi {
  id: string;
  name: string;
  variants: ArduinoBuilderBoardMenuVariantv3_BuilderApi[];
}

export interface ArduinoBuilderBoardv3Full_BuilderApi {
  board_id: string;
  architecture: string;
  fqbn: string;
  name: string;
  vendor: string;
  board_options?: ArduinoBuilderBoardMenuv3_BuilderApi[];
}

export type ArduinoBuilderBoard_BuilderApi = {
  items: Pick<
    ArduinoBuilderBoardv3Full_BuilderApi,
    'board_id' | 'name' | 'fqbn' | 'architecture'
  >[];
};

export type GetBoardsByVidPid_Response = {
  id: string;
  architecture: string;
  fqbn: string;
  name: string;
};

export type GetBoardByFqbn_Response = {
  id: string;
  architecture: string;
  fqbn: string;
  name: string;
  vendor: string;
  menus?: ArduinoBuilderBoardMenuv3_BuilderApi[];
};

interface ArduinoBuilderBoardv3_BuilderApi {
  architecture: string;
  fqbn: string;
  href: string;
  name: string;
  package: string;
  plan: string;
}

export interface ArduinoBuilderBoardsv3_BuilderApi {
  items: ArduinoBuilderBoardv3_BuilderApi[];
  next?: string;
  prev?: string;
}

export type ArduinoBuilderBoardv3WithId = ArduinoBuilderBoardv3_BuilderApi & {
  id: string;
};

export type GetBoards_Response = {
  boards: ArduinoBuilderBoardv3WithId[];
  next?: string;
  prev?: string;
};

interface boardscomputev3_BuilderApi {
  os?: string;
  verbose: boolean;
  verify?: boolean;
}

export type BoardsCompute_Params = { fqbn: string };

export type BoardsCompute_Body = boardscomputev3_BuilderApi;

interface ArduinoBuilderBoardscomputev3Options_BuilderApi {
  use_1200bps_touch: boolean;
  wait_for_upload_port: boolean;
}

export interface ArduinoBuilderBoardscomputev3Tool_BuilderApi {
  name: string;
  version: string;
  packager: string;
  url: string;
  signature: string;
  checksum: string;
}

export interface ArduinoBuilderBoardscomputev3_BuilderApi {
  commandline: string;
  files: ArduinoBuilderExtrafile[];
  options: ArduinoBuilderBoardscomputev3Options_BuilderApi;
  signature: string;
  tools: ArduinoBuilderBoardscomputev3Tool_BuilderApi[];
}

export type Compute_Response = ArduinoBuilderBoardscomputev3_BuilderApi;
