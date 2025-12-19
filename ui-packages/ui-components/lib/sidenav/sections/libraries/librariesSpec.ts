import {
  SidenavLibrariesIds,
  SidenavLibrariesItemDictionary,
  SidenavTabItem,
} from '../../sidenav.type';
import { sidenavLibrariesMessages } from './messages';

const sidenavLibrariesItems: SidenavLibrariesItemDictionary = {
  [SidenavLibrariesIds.Standard]: {
    id: SidenavLibrariesIds.Standard,
    label: sidenavLibrariesMessages[SidenavLibrariesIds.Standard],
  },
  [SidenavLibrariesIds.Custom]: {
    id: SidenavLibrariesIds.Custom,
    label: sidenavLibrariesMessages[SidenavLibrariesIds.Custom],
  },
  [SidenavLibrariesIds.Favorites]: {
    id: SidenavLibrariesIds.Favorites,
    label: sidenavLibrariesMessages[SidenavLibrariesIds.Favorites],
  },
};

export const sidenavLibrariesTabs: SidenavTabItem[] = [
  sidenavLibrariesItems.Standard,
  sidenavLibrariesItems.Custom,
  sidenavLibrariesItems.Favorites,
];
