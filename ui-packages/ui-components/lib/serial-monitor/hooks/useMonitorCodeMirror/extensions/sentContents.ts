import {
  RangeSet,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
} from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

import styles from '../../../serial-monitor.module.scss';
import { reset } from './reset';

export type SentContent = { from: number; textContent: string };

const addSentContent = StateEffect.define<SentContent>({
  map: ({ from, textContent }, change) => ({
    from: change.mapPos(from),
    textContent,
  }),
});

export function sentIncluded(tr: Transaction): boolean {
  return tr.effects.some((e) => e.is(addSentContent));
}

const sentHighlighting = Decoration.mark({
  class: styles['serial-monitor-contents-message-sent'],
});

export const sentContents = StateField.define<SentContent[]>({
  create() {
    return [];
  },
  update(sentInputs, tr) {
    for (const e of tr.effects)
      if (e.is(addSentContent)) {
        sentInputs = [
          ...sentInputs,
          {
            from: e.value.from,
            textContent: e.value.textContent,
          },
        ];
      } else if (e.is(reset)) sentInputs = [];
    return sentInputs;
  },
  provide: (f) => [
    EditorView.decorations.from(f, (values) =>
      RangeSet.of(
        values.map(({ from, textContent }) =>
          sentHighlighting.range(from, from + textContent.length),
        ),
      ),
    ),
  ],
});

export function addSentContentEffect(
  tr: TransactionSpec,
  from: number,
  textContent: string,
): void {
  if (!tr.effects) {
    tr.effects = [];
  }
  (tr.effects as StateEffect<any>[]).push(
    addSentContent.of({
      from,
      textContent,
    }),
  );
}
