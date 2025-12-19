import { CamelCasedProperties } from 'type-fest';

import { ArduinoBuilderExample_BuilderApi } from './builderApi.examples.type';

export interface GetLibraries_Params {
  architecture?: string[] | string;
  category?: string;
  limit?: number;
  maintainer?: string;
  page?: number;
  search?: string;
  type?: string;
  without_type?: string;
}

export interface GetLibrary_Params {
  id: string;
  isLatest?: boolean;
}

export interface LibraryFile {
  name: string;
  path: string;
  href: string;
  mimetype: string;
}

export interface LibraryArchive {
  url: string;
  size: number;
  checksum: string;
  filename: string;
}

export interface Library {
  architectures: string[];
  category: string;
  code: string;
  download_url: string;
  examples_number: number;
  href: string;
  id: string;
  license: string;
  maintainer: string;
  name: string;
  sentence: string;
  types: string[];
  url: string;
  version: string;
  files?: LibraryFile[];
  archive?: LibraryArchive;
  examples?: LibraryExample[];
}
export interface LibraryExample {
  name: string;
  path: string;
}
export interface LibraryFiles {
  files: LibraryFile[];
}
export interface LibraryExamples {
  examples: LibraryExample[];
}

export interface Libraries {
  libraries: Library[];
  page: number;
  pages: number;
  total_items: number;
}
export type LibraryDetails = Library & {
  examples?: ArduinoBuilderExample_BuilderApi[];
  files?: LibraryFile[];
  other_versions?: string[];
  path?: string;
  download_url?: string;
};

export type LibraryDetails_Response = CamelCasedProperties<LibraryDetails>;

export enum IsFavoriteLibrary {
  Yes = 'yes',
  No = 'no',
  Unknown = 'unknown',
}

export type LibrariesItem_Response = CamelCasedProperties<Library> & {
  isFavorite: IsFavoriteLibrary;
  otherVersions?: string[];
  downloadUrl?: string;
  __versionForDownload?: string;
  __releaseId?: string;
};

export interface GetLibraries_Response {
  libraries: LibrariesItem_Response[];
  page: number;
  pages: number;
  totalItems: number;
  nextPage?: number;
}

export type GetFavoriteLibraries_Response = LibrariesItem_Response[];

export interface FavoriteLibrary_Params {
  id: string;
}

export interface LibraryRepository_New {
  url: string;
  stars: number;
  forks: number;
  updated_at: string; // ISO string
}

export interface LibraryRelease_New {
  id: string; // es. "SBK_MAX72xx@2.0.0"
  version: string; // es. "2.0.0"
}

export interface LibrariesItem_New {
  name: string;
  id: string;
  repository?: LibraryRepository_New;
  website?: string;
  license?: string;
  architectures?: string[];
  types?: string[];
  category?: string;
  maintainer?: string;
  author?: string;
  sentence?: string;
  paragraph?: string;
  includes?: string[];
  dependencies?: { name: string }[];
  example_count?: number;
  releases?: LibraryRelease_New[];
}

export interface GetLibraries_Response_New {
  items?: LibrariesItem_New[];
  libraries?: LibrariesItem_New[];
  pagination: {
    next_page?: number;
    total_pages: number;
    total_items: number;
    page: number;
    per_page: number;
  };
}

export interface ReleaseFile {
  name: string;
  path: string;
  mimetype: string;
  data: string;
}

export interface ReleaseFilesResponse {
  files: ReleaseFile[];
}
