// A table's leading glyph: an emoji (core categories) or a brick-category icon
export type ExampleTableIcon =
  | { kind: 'emoji'; value: string }
  | { kind: 'brick'; category?: string };

export interface ExampleRowVM {
  // The routable id used for navigation (encoded_id, falling back to id)
  id: string;
  title: string;
  description?: string;
}

export interface ExampleTableVM {
  id: string;
  title: string;
  count: number;
  icon?: ExampleTableIcon;
  rows: ExampleRowVM[];
}

export interface ExampleSectionVM {
  id: string;
  title: string;
  description: string;
  count: number;
  tables: ExampleTableVM[];
}

export type ExamplesLogic = () => {
  sections: ExampleSectionVM[];
  isLoading: boolean;
  onSelectExample: (encodedId: string) => void;
};

export interface ExamplesProps {
  examplesLogic: ExamplesLogic;
}
