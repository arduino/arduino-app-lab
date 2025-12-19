import { LibrariesItem_Response } from '@cloud-editor-mono/infrastructure';

import { SidenavStandardLibrary } from '../../sidenav.type';

// we can have pinned library metadata that includes only the name and version
// this function derives the library id from the metadata
export function createLibraryIdFromMetadata(
  name: string,
  version: string,
): string {
  const cleanName = name.trim();
  const cleanVersion = version.trim();
  return `${cleanName}@${cleanVersion}`;
}
export function createLibraryComponentKey(
  library: SidenavStandardLibrary,
  pinnedVersion?: string,
): string {
  return `libraries-list-item-${library.id}-${
    pinnedVersion || `${(library as LibrariesItem_Response).version}-latest`
  }`;
}

export function createLibraryVersionId(
  id: string,
  version: string,
  latest?: boolean,
): string {
  return `lib-${id}-${latest ? 'latest' : version}`;
}

export const ARDUINO_LIB_TYPE_STRING = 'Arduino';

export const createDefaultVersionLabel = (
  prefix: string,
  version: string,
): string => `${prefix} (${version})`;

export const createDefaultVersionGroupName = (id: string): string =>
  `${id}-default-version-group`;

export const createOtherVersionsGroupName = (id: string): string =>
  `${id}-other-versions-group`;
