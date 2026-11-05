import {
  Range,
  RangeSet,
  StateEffect,
  StateEffectType,
  StateField,
} from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';

import { ViewInstances } from '../../codeMirrorViewInstances';
import styles from './error-highlight.module.scss';

export type ErrorHighlightStateEffectValue = number[];

export type ErrorHighlightStateEffect =
  StateEffect<ErrorHighlightStateEffectValue>;

type ErrorHighlightStateEffectType =
  StateEffectType<ErrorHighlightStateEffectValue>;

const errorHighlight: ErrorHighlightStateEffectType =
  StateEffect.define<ErrorHighlightStateEffectValue>();

const errorLineHighlightDecoration = Decoration.line({
  attributes: { class: styles.errorLine },
});

const errorContentHighlightDecoration = Decoration.line({
  attributes: {
    style: `color: ${styles.errorContentColor}!important;`,
  },
});

const stateEffectValueToDecoration = (
  n: number,
  type: 'content' | 'line',
): Range<Decoration> =>
  type === 'line'
    ? errorLineHighlightDecoration.range(n)
    : errorContentHighlightDecoration.range(n);

export const createErrorHighlightStateField = (
  initialValue?: ErrorHighlightStateEffectValue,
  viewInstanceId?: ViewInstances,
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
                    // just incase a non existent error line number
                    // makes it to the extension ignore the related error
                    return undefined;
                  }
                })
                .filter((v): v is number => typeof v !== 'undefined')
                .map((n) =>
                  stateEffectValueToDecoration(
                    n,
                    viewInstanceId === ViewInstances.Editor
                      ? 'line'
                      : 'content',
                  ),
                ),
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

      const errorHighlightEffects: ErrorHighlightStateEffect[] =
        transaction.effects.filter((effect) => effect.is(errorHighlight));

      for (const effect of errorHighlightEffects) {
        const add = effect.value.map((n) =>
          stateEffectValueToDecoration(
            n,
            viewInstanceId === ViewInstances.Editor ? 'line' : 'content',
          ),
        );

        lines = lines.update({
          add,
        });
      }

      return lines;
    },
  });
};

export const createHighlightErrorsEffect = (
  lineNumbers: ErrorHighlightStateEffectValue,
  viewInstance: EditorView,
): ErrorHighlightStateEffect => {
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

  return errorHighlight.of(docPositions);
};
