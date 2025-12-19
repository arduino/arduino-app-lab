import { LibrariesItem_Response } from '@bcmi-labs/cloud-editor-infrastructure/src';

import { DropdownMenuSectionType } from '../../../essential/dropdown-menu';
import {
  GetCustomLibrary,
  GetLibrary,
  LibraryMenuHandlerDictionary,
  OnClickInclude,
  SetFavoriteLibrary,
  SidenavCustomLibrary,
  SidenavStandardLibrary,
} from '../../sidenav.type';

export interface StandardLibraryListItemProps {
  isCustom: false;
  standardLibrary: SidenavStandardLibrary;
  customLibrary?: SidenavCustomLibrary;
  pinnedVersion?: string;
  getLibraryDetails: GetLibrary;
  setFavorite: SetFavoriteLibrary;
  containerStyle?: React.CSSProperties;
  onHeightChange?: (index?: number) => void;
  disableVersionSelect: boolean;
}

export interface CustomLibraryListItemProps {
  isCustom: true;
  standardLibrary: undefined;
  customLibrary: SidenavCustomLibrary;
  pinnedVersion: undefined;
  getLibraryDetails: GetCustomLibrary;
  setFavorite: undefined;
  containerStyle: undefined;
  onHeightChange: undefined;
  disableVersionSelect: undefined;
}

export interface CommonListItemProps {
  libraryMenuHandlers: LibraryMenuHandlerDictionary;
  onClickInclude: OnClickInclude;
  index?: number;
  hydrateExamplesByPaths: (paths: string[]) => Promise<void>;
}

export type LibraryListItemProps = (
  | StandardLibraryListItemProps
  | CustomLibraryListItemProps
) &
  CommonListItemProps;

export interface VersionSelection {
  originalId: string;
  id: string;
  label: string;
  version: string;
}

export type SectionType = DropdownMenuSectionType<string, string>;
export type Versions = (Omit<SectionType, 'items'> & {
  items: (SectionType['items'][number] & {
    originalId: string;
  })[];
})[];

export interface LibraryWithActionVersion extends LibrariesItem_Response {
  __releaseId?: string; // es: "lvgl@9.4.0"
}
