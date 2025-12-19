import {
  ArduinoCreateSketchesV2_CreateApi,
  ArduinoCreateSketchV2_CreateApi,
  ArduinoCreateUser_CreateApi,
  CreateSketch_Response,
  CreateUser_Response,
  DeleteSketchFile_Response,
  FileContentV2_CreateApi,
  FileContentV2Write_CreateApi,
  FileV2Delete_CreateApi,
  FileV2List_CreateApi,
  GetFileContents_Response,
  GetFileHash_CreateApi,
  GetFileHash_Response,
  GetFilesList_Response,
  GetLibrariesList_Response,
  GetSketch_Response,
  Libs_CreateApi,
  PostSketchFile_Response,
} from './createApi.type';

export function mapCreateSketchResponse(
  data: ArduinoCreateSketchV2_CreateApi,
): CreateSketch_Response {
  return {
    fqbn: data.board_fqbn,
    boardName: data.board_name,
    boardType: data.board_type,
    createdAt: data.created_at,
    href: data.href,
    id: data.id,
    isPublic: data.is_public,
    libraries: data.libraries,
    modifiedAt: data.modified_at,
    name: data.name,
    path: data.path,
    tutorials: data.tutorials,
    types: data.types,
    userId: data.user_id,
    organizationId: data.organization_id,
  };
}

export function mapGetSketchResponse(
  data: ArduinoCreateSketchV2_CreateApi,
): GetSketch_Response {
  return {
    fqbn: data.board_fqbn,
    boardName: data.board_name,
    boardType: data.board_type,
    createdAt: data.created_at,
    href: data.href,
    id: data.id,
    isPublic: data.is_public,
    libraries: data.libraries,
    modifiedAt: data.modified_at,
    name: data.name,
    path: data.path,
    tutorials: data.tutorials,
    types: data.types,
    userId: data.user_id,
    organizationId: data.organization_id,
    thingId: data.thing_id,
    secrets: data.secrets,
    size: data.size,
  };
}

export function mapGetSketchesResponse(
  data: ArduinoCreateSketchesV2_CreateApi,
): GetSketch_Response[] {
  return Array.isArray(data.sketches) // maybe not required
    ? data.sketches.map(mapGetSketchResponse)
    : [];
}

export function mapGetFileContentsResponse(
  data: FileContentV2_CreateApi,
): GetFileContents_Response {
  return {
    data: data.data,
    href: data.href,
    mimetype: data.mimetype,
    modifiedAt: data.modified_at,
    path: data.path,
    revision: data.revision
      ? mapGetCurrentSketchEditorsResponse(data?.revision)
      : undefined,
  };
}

export function mapGetFilesListResponse(
  data: FileV2List_CreateApi | unknown,
): GetFilesList_Response {
  return Array.isArray(data)
    ? (data as FileV2List_CreateApi).map((file) => ({
        href: file.href,
        mimetype: file.mimetype,
        modifiedAt: file.modified_at,
        path: file.path,
        type: file.type,
        name: file.name,
        children: file.children,
        revision: file.revision
          ? mapGetCurrentSketchEditorsResponse(file?.revision)
          : undefined,
      }))
    : [];
}

export function mapPostFileResponse(
  data: FileContentV2Write_CreateApi,
): PostSketchFile_Response {
  return {
    bytes: data.bytes,
    bytesB64: data.bytes_b64,
    hash: data.hash,
  };
}

export function mapDeleteFileResponse(
  data: FileV2Delete_CreateApi,
): DeleteSketchFile_Response {
  return { status: data.status };
}

export function mapGetCustomLibrariesResponse(
  data: Libs_CreateApi,
): GetLibrariesList_Response {
  return data.map((lib) => {
    if (!lib.id)
      throw new Error('Missing library id in custom library api response');

    return {
      name: lib.name,
      path: lib.path,
      properties: lib.properties,
      id: lib.id,
      userId: lib.user_id,
      examplesChildren: lib.examples_children,
    };
  });
}

export function mapGetCurrentSketchEditorsResponse(
  data: GetFileHash_CreateApi,
): GetFileHash_Response {
  return {
    filename: data.filename,
    hash: data.hash,
    modifiedAt: data.modified_at,
    username: data.username,
  };
}

export function mapGetUserResponse(
  data: ArduinoCreateUser_CreateApi,
): CreateUser_Response {
  return {
    activated: data.activated,
    created: data.created,
    email: data.email,
    id: data.id,
    limits: data.limits,
    prefs: data.prefs,
    username: data.username,
  };
}
