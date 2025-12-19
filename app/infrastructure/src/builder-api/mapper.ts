import { uniqueId } from 'lodash';

import {
  ArduinoBuilderBoard_BuilderApi,
  ArduinoBuilderBoardscomputev3_BuilderApi,
  ArduinoBuilderBoardsv3_BuilderApi,
  ArduinoBuilderBoardv3Full_BuilderApi,
  Compute_Response,
  GetBoardByFqbn_Response,
  GetBoards_Response,
  GetBoardsByVidPid_Response,
} from './builderApi.boards.type';
import {
  ArduinoBuilderV2CompilationOutputResponse_BuilderApi,
  ArduinoBuilderV2CompilationsResponse_BuilderApi,
  CompileSketch_Response,
} from './builderApi.compilations.type';
import {
  ArduinoBuilderExample_BuilderApi,
  ArduinoBuilderExampleFile_BuilderApi,
  GetExampleFileContents_Response,
  GetExamples_Response,
} from './builderApi.examples.type';
import {
  GetLibraries_Response as GetLibraries_Response_Legacy,
  GetLibraries_Response_New,
  LibrariesItem_New,
  LibrariesItem_Response as LibrariesItem_Response_Legacy,
  Library,
  LibraryDetails_Response,
} from './builderApi.libraries.type';
import {
  ArduinoBuilderExtrafile,
  ArduinoBuilderExtrafileV2,
} from './builderApi.type';

export const pickLatestVersion = (
  releases?: { version: string }[],
): string | undefined =>
  Array.isArray(releases) && releases.length > 0
    ? releases[0].version
    : undefined;

export function normalizeV2toV1Extrafiles(
  data: ArduinoBuilderExtrafileV2[],
): ArduinoBuilderExtrafile[] {
  return data.map((item) => ({
    filename: item.filename,
    hex: item.data,
  }));
}

export function mapBuilderCompilationOutputNormalizeV2toV1Response(
  data: ArduinoBuilderV2CompilationOutputResponse_BuilderApi,
): CompileSketch_Response & { name: string } {
  return {
    name: data.name,
    bin: data?.bin,
    hex: data?.hex,
    elf: data?.elf,
    otaKey: data?.ota_key,
    files: data?.extra_files
      ? normalizeV2toV1Extrafiles(data?.extra_files)
      : undefined,
  };
}

export function mapSketchCompilationResponse(
  data: ArduinoBuilderV2CompilationsResponse_BuilderApi,
): ArduinoBuilderV2CompilationsResponse_BuilderApi {
  return data;
}

export function mapGetBoards(
  data: ArduinoBuilderBoardsv3_BuilderApi,
): GetBoards_Response {
  const boards = data.items.map((item) => ({
    id: uniqueId(),
    ...item,
  }));

  return {
    boards,
  };
}

export function mapGetBoardsByVidPid(
  data: ArduinoBuilderBoard_BuilderApi,
): GetBoardsByVidPid_Response {
  const firstItem = data && data.items && data.items[0];
  return {
    id: firstItem.board_id,
    name: firstItem.name,
    fqbn: firstItem.fqbn,
    architecture: firstItem.architecture,
  };
}

export function mapGetBoardByFqbn(
  data: ArduinoBuilderBoardv3Full_BuilderApi,
): GetBoardByFqbn_Response {
  return {
    id: data.board_id,
    architecture: data.architecture,
    fqbn: data.fqbn,
    name: data.name,
    menus: data.board_options,
    vendor: data.vendor,
  };
}

export function mapComputeUploadToBoardByFqbn(
  data: ArduinoBuilderBoardscomputev3_BuilderApi,
): Compute_Response {
  return {
    commandline: data.commandline,
    options: data.options,
    signature: data.signature,
    tools: data.tools,
    files: data.files,
  };
}

export function mapGetExamplesDataResponse(
  data: ArduinoBuilderExample_BuilderApi[],
): GetExamples_Response {
  return {
    examples: data,
  };
}

export function mapGetExampleFileContentsResponse(
  data: ArduinoBuilderExampleFile_BuilderApi,
): GetExampleFileContents_Response {
  return {
    name: data.name,
    data: data.data,
    mimetype: data.mimetype,
    href: data.href,
    path: data.path,
  };
}

export const mapLibraryNewToLegacy = (
  lib: LibrariesItem_New,
): LibrariesItem_Response_Legacy => {
  // header -> code
  const pickHeader = () => {
    const files = lib.includes ?? [];
    if (!files.length) return undefined;
    const lower = lib.name?.toLowerCase?.();
    const byName =
      files.find((f) => f.toLowerCase().includes(lower)) ||
      files.find((f) => /\.h(pp)?$/i.test(f));
    return byName || files[0];
  };
  const header = pickHeader();
  const codeInclude = header ? `#include <${header}>` : undefined;

  const current = pickLatestVersion(lib.releases);
  const otherVersions = (lib.releases ?? [])
    .map((r) => r.version)
    .filter((v) => v && v !== current) as string[];

  return {
    architectures: lib.architectures ?? ['*'],
    category: lib.category ?? '',
    code: codeInclude,
    href: `/v1/libraries/${lib.id}`,
    id: lib.id,
    license: lib.license ?? '',
    maintainer: lib.maintainer ?? lib.author ?? '',
    name: lib.name,
    sentence: lib.sentence ?? lib.paragraph ?? '',
    types: lib.types ?? [],
    url: lib.website ?? lib.repository?.url ?? '',
    version: current,
    otherVersions,
    examplesNumber: lib.example_count ?? 0,
  } as unknown as LibrariesItem_Response_Legacy;
};
export const mapGetLibrariesNewToLegacy = (
  data: GetLibraries_Response_New,
): GetLibraries_Response_Legacy => {
  const list = (data.items ?? data.libraries ?? []).map(mapLibraryNewToLegacy);

  return {
    libraries: list,
    page: data.pagination.page,
    pages: data.pagination.total_pages,
    totalItems: data.pagination.total_items,
    nextPage: data.pagination.next_page,
  };
};

export const mapReleaseNewToLibraryDetailsLegacy = (
  rel: Library,
): LibraryDetails_Response => {
  const base = mapLibraryNewToLegacy(rel);

  return {
    ...base,
    id: rel.name ?? base.id,
    version: rel.version ?? base.version,
    files: rel.files ?? [],
    examples: rel.examples ?? [],
    otherVersions: undefined,
    downloadUrl: rel.archive?.url ?? '',
  };
};
