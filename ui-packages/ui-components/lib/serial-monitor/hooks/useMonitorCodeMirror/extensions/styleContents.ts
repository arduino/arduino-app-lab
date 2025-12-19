import {
  RangeSet,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

import { reset } from './reset';

export type StyledContent = {
  from: number;
  textContent: string;
  className: string;
};

const addStyledContent = StateEffect.define<StyledContent>({
  map: ({ from, textContent, className }, change) => ({
    from: change.mapPos(from),
    textContent,
    className,
  }),
});

const styledHighlighting = (className: string): Decoration =>
  Decoration.mark({
    class: className,
  });

export const styledContents = StateField.define<StyledContent[]>({
  create() {
    return [];
  },
  update(styledContents, tr) {
    for (const e of tr.effects)
      if (e.is(addStyledContent)) {
        styledContents = [
          ...styledContents,
          {
            from: e.value.from,
            textContent: e.value.textContent,
            className: e.value.className,
          },
        ];
      } else if (e.is(reset)) styledContents = [];
    return styledContents;
  },
  provide: (f) => [
    EditorView.decorations.from(f, (values) =>
      RangeSet.of(
        values.map(({ from, textContent, className }) =>
          styledHighlighting(className).range(from, from + textContent.length),
        ),
      ),
    ),
  ],
});

export function addStyledContentEffect(
  tr: TransactionSpec,
  from: number,
  textContent: string,
  className: string,
): void {
  if (!tr.effects) {
    tr.effects = [];
  }
  (tr.effects as StateEffect<any>[]).push(
    addStyledContent.of({
      from,
      textContent,
      className,
    }),
  );
}
