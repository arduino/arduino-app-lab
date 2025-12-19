import { ReferenceCategory } from '@cloud-editor-mono/infrastructure';
import { defineMessages } from 'react-intl';

import { SidenavReferenceIds } from '../../sidenav.type';

export const sidenavReferenceMessages = defineMessages<
  keyof typeof SidenavReferenceIds
>({
  [SidenavReferenceIds.Functions]: {
    id: 'sidenavReference.functions',
    defaultMessage: 'Functions',
    description: 'Functions',
  },
  [SidenavReferenceIds.Variables]: {
    id: 'sidenavReference.variables',
    defaultMessage: 'Variables',
    description: 'Variables',
  },
  [SidenavReferenceIds.Structure]: {
    id: 'sidenavReference.structure',
    defaultMessage: 'Structures',
    description: 'Structures',
  },
});

export const referenceCategoryMessages = defineMessages<ReferenceCategory>({
  [ReferenceCategory.Functions]: {
    id: 'referenceCategory.functions',
    defaultMessage:
      'For controlling the Arduino board and performing computations.',
    description: 'Description of Functions section in the reference',
  },
  [ReferenceCategory.Variables]: {
    id: 'referenceCategory.variables',
    defaultMessage: 'Arduino data types and constants.',
    description: 'Description of Variables section in the reference',
  },
  [ReferenceCategory.Structure]: {
    id: 'referenceCategory.structure',
    defaultMessage: 'The elements of Arduino (C++) code.',
    description: 'Description of Structures section in the reference',
  },
});
