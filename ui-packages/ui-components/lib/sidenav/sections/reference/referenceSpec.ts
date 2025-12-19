import { ReferenceCategory } from '@cloud-editor-mono/infrastructure';

import {
  SidenavReferenceIds,
  SidenavReferenceItemDictionary,
  SidenavTabItem,
} from '../../sidenav.type';
import { sidenavReferenceMessages } from './messages';

const sidenavReferenceItems: SidenavReferenceItemDictionary = {
  [SidenavReferenceIds.Functions]: {
    id: SidenavReferenceIds.Functions,
    label: sidenavReferenceMessages[SidenavReferenceIds.Functions],
  },
  [SidenavReferenceIds.Variables]: {
    id: SidenavReferenceIds.Variables,
    label: sidenavReferenceMessages[SidenavReferenceIds.Variables],
  },
  [SidenavReferenceIds.Structure]: {
    id: SidenavReferenceIds.Structure,
    label: sidenavReferenceMessages[SidenavReferenceIds.Structure],
  },
};

export const sidenavReferenceTabs: SidenavTabItem[] = [
  sidenavReferenceItems.Functions,
  sidenavReferenceItems.Variables,
  sidenavReferenceItems.Structure,
];

export const referenceCategoryToTab = {
  [ReferenceCategory.Functions]: SidenavReferenceIds.Functions,
  [ReferenceCategory.Variables]: SidenavReferenceIds.Variables,
  [ReferenceCategory.Structure]: SidenavReferenceIds.Structure,
};

export const tabToReferenceCategory = {
  [SidenavReferenceIds.Functions]: ReferenceCategory.Functions,
  [SidenavReferenceIds.Variables]: ReferenceCategory.Variables,
  [SidenavReferenceIds.Structure]: ReferenceCategory.Structure,
};
