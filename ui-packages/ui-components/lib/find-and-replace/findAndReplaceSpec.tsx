import {
  CaseSensitive,
  RegularExpression,
  WholeWords,
} from '@cloud-editor-mono/images/assets/icons';

import { FilterChipIds, FilterChipType } from './findAndReplace.type';

export const FilterChips: Array<FilterChipType> = [
  {
    id: FilterChipIds.CaseSensitive,
    label: 'Case Sensitive',
    icon: CaseSensitive,
  },
  {
    id: FilterChipIds.WholeWords,
    label: 'Whole Words',
    icon: WholeWords,
  },
  {
    id: FilterChipIds.RegularExpression,
    label: 'Regular Expression',
    icon: RegularExpression,
  },
];
