/* How read from the md files */
export type LearnTag = {
  id: string;
  label: string;
};

/* Color definition for tags (pills) */
export type LearnTagColor = {
  color: string;
  bgColor: string;
};

/* Full tag, with id, label and colors */
export type LearnTagPill = LearnTag & LearnTagColor;

export type LearnListItem = {
  id: string;
  title: string;
  description: string;
  tags: LearnTag[];
  icon: 'account' | 'hardware' | 'user' | 'navigation' | 'navigation-2';
  category?: 'basic'; // It will be extended in the future
  lastRevision?: Date;
};

export type LearnListItemWithColors = Omit<LearnListItem, 'tags'> & {
  tags: LearnTagPill[];
};

export type LearnResource = {
  id: string;
  title: string;
  description?: string;
  content: string;
  icon: 'account' | 'hardware' | 'user' | 'navigation' | 'navigation-2';
  lastRevision?: Date;
};
