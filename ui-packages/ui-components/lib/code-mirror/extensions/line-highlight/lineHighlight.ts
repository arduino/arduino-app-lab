import {
  Range,
  RangeSet,
  StateEffect,
  StateEffectType,
  StateField,
} from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';

import styles from './line-highlight.module.scss';

export type LineHighlightStateEffectValue = number[];

export type LineHighlightStateEffect =
  StateEffect<LineHighlightStateEffectValue>;

type LineHighlightStateEffectType =
  StateEffectType<LineHighlightStateEffectValue>;

const LineHighlight: LineHighlightStateEffectType =
  StateEffect.define<LineHighlightStateEffectValue>();

const lineHighlightDecoration = Decoration.line({
  attributes: { class: styles.line },
});

const stateEffectValueToDecoration = (n: number): Range<Decoration> =>
  lineHighlightDecoration.range(n);

export const createLineHighlightStateField = (
  initialValue?: LineHighlightStateEffectValue,
): StateField<DecorationSet> => {
  return StateField.define<DecorationSet>({
    create(state) {
      try {
        return initialValue
          ? RangeSet.of(
              initialValue
                .map((ln) => {
                  try {
                    return state.doc.line(ln).from;
                  } catch (e) {
                    console.error(e);
                    // just incase a non existent line number
                    // makes it to the extension ignore the related line number
                    return undefined;
                  }
                })
                .filter((v): v is number => typeof v !== 'undefined')
                .map((n) => stateEffectValueToDecoration(n)),
            )
          : Decoration.none;
      } catch (e) {
        console.error(e);
        return Decoration.none;
      }
    },

    provide(f) {
      return EditorView.decorations.from(f);
    },

    update(value, transaction) {
      let lines = value.map(transaction.changes);

      const lineHighlightEffects: LineHighlightStateEffect[] =
        transaction.effects.filter((effect) => effect.is(LineHighlight));

      for (const effect of lineHighlightEffects) {
        const add = effect.value.map((n) => stateEffectValueToDecoration(n));

        lines = lines.update({
          add,
        });
      }

      return lines;
    },
  });
};

export const createHighlightErrorsEffect = (
  lineNumbers: LineHighlightStateEffectValue,
  viewInstance: EditorView,
): LineHighlightStateEffect => {
  const docPositions = lineNumbers
    .map((ln) => {
      try {
        return viewInstance.state.doc.line(ln).from;
      } catch (e) {
        console.error(e);
        return undefined;
      }
    })
    .filter((v): v is number => typeof v !== 'undefined');

  return LineHighlight.of(docPositions);
};
