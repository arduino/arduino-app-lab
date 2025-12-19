import { NonEmptyStringArray } from '@cloud-editor-mono/common';
import { ReferenceCategory } from '@cloud-editor-mono/infrastructure';

export interface ReferencePath {
  category: ReferenceCategory;
  itemPath: NonEmptyStringArray | null;
}

export interface ReferenceItem {
  template: string;
}

export interface ReferenceSearchItem {
  title: string;
  path: string;
}

export type ReferenceSearchResult = {
  [value in ReferenceCategory]: {
    [key: string]: ReferenceSearchItem[];
  };
};

export type SubcategoryMap = Map<
  string,
  { label: string; entries: Map<string, ReferenceEntry> }
>;

export type CategoryTree = {
  [key in ReferenceCategory]: SubcategoryMap;
};

export interface ReferenceEntry {
  href: string;
  label: string;
}
