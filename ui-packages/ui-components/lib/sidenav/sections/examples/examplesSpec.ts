import {
  ExamplesMenuItemDictionary,
  ExamplesMenuItemIds,
  ExamplesMenuSection,
  SidenavExamplesIds,
  SidenavExamplesItemDictionary,
  SidenavTabItem,
} from '../../sidenav.type';
import { examplesMenuMessages, sidenavExamplesMessages } from './messages';

const sidenavExamplesItems: SidenavExamplesItemDictionary = {
  [SidenavExamplesIds.Device]: {
    id: SidenavExamplesIds.Device,
    label: sidenavExamplesMessages[SidenavExamplesIds.Device],
  },
  [SidenavExamplesIds.BuiltIn]: {
    id: SidenavExamplesIds.BuiltIn,
    label: sidenavExamplesMessages[SidenavExamplesIds.BuiltIn],
  },
  [SidenavExamplesIds.FromLibraries]: {
    id: SidenavExamplesIds.FromLibraries,
    label: sidenavExamplesMessages[SidenavExamplesIds.FromLibraries],
  },
};

export const sidenavExamplesTabs: SidenavTabItem[] = [
  sidenavExamplesItems.Device,
  sidenavExamplesItems.BuiltIn,
  sidenavExamplesItems.FromLibraries,
];

const examplesMenuItems: ExamplesMenuItemDictionary = {
  [ExamplesMenuItemIds.CopyInYourSketches]: {
    id: ExamplesMenuItemIds.CopyInYourSketches,
    label: examplesMenuMessages[ExamplesMenuItemIds.CopyInYourSketches],
  },
  [ExamplesMenuItemIds.Download]: {
    id: ExamplesMenuItemIds.Download,
    label: examplesMenuMessages[ExamplesMenuItemIds.Download],
  },
};

export const examplesMenuSections: ExamplesMenuSection[] = [
  {
    name: 'First Group',
    items: [examplesMenuItems.CopyInYourSketches, examplesMenuItems.Download],
  },
];
