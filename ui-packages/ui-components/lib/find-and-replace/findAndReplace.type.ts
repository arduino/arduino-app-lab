import { EditorView } from '@codemirror/view';

export interface FindAndReplaceProps {
  view: EditorView;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  totalOccurrences: number;
  setTotalOccurrences: React.Dispatch<React.SetStateAction<number>>;
  replaceOpen?: boolean;
  hasHeader?: boolean;
}

export interface FindSectionProps {
  view: EditorView;
  loading: boolean;
  currentMatch: number;
  selectPrevMatch: () => void;
  selectNextMatch: () => void;
  searchState: SearchState;
  setSearchState: React.Dispatch<React.SetStateAction<SearchState>>;
  totalOccurrences: number;
}

export interface ReplaceSectionProps {
  view: EditorView;
  searchState: SearchState;
  totalOccurrences: number;
  selectNextMatch: () => void;
}

export enum FilterChipIds {
  RegularExpression = 'regexp',
  WholeWords = 'wholeWord',
  CaseSensitive = 'caseSensitive',
}

export type FilterChipType = {
  id: FilterChipIds;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

//Search state
export type SearchState = {
  searchValue: string;
  [FilterChipIds.CaseSensitive]: boolean;
  [FilterChipIds.RegularExpression]: boolean;
  [FilterChipIds.WholeWords]: boolean;
};
