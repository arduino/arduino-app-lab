import { EditorState, Line, StateField, Transaction } from '@codemirror/state';

import { LINE_SEPARATOR } from '../constants';
import { reset } from './reset';
import { sentIncluded } from './sentContents';
import { buildTimestamp } from './timestamps';

type ValueType = 'sent' | 'received' | 'sent/received' | 'unset';
type Value = {
  timestamp: string;
  content: string;
  type: ValueType;
};
type ValueTypeInput = 'sent' | 'received';

const lineTypeGraph: Record<ValueType, Record<ValueTypeInput, ValueType>> = {
  sent: {
    sent: 'sent',
    received: 'sent/received',
  },
  received: {
    sent: 'sent/received',
    received: 'received',
  },
  ['sent/received']: {
    sent: 'sent/received',
    received: 'sent/received',
  },
  unset: {
    sent: 'sent',
    received: 'received',
  },
};

function trailingEmptyLine(line: Line, state: EditorState): boolean {
  const isLast = line.number === state.doc.lines;
  const isEmpty = line.length === 0;

  return isLast && isEmpty;
}

export const trackedData = StateField.define<Value[]>({
  create() {
    return [];
  },
  update(values, tr) {
    if (tr.effects.some((e) => e.is(reset))) return [];

    const timestamp = buildTimestamp(tr.annotation(Transaction.time));
    const type = sentIncluded(tr) ? 'sent' : 'received';
    const doc = tr.state.doc;

    tr.changes.iterChanges((_, __, from, to) => {
      const startLineN = doc.lineAt(from).number;
      const endLineN = doc.lineAt(to).number;

      for (let i = startLineN; i <= endLineN; i++) {
        const line = doc.line(i);

        if (trailingEmptyLine(line, tr.state)) continue;

        values[i] = {
          timestamp,
          content:
            doc.sliceString(line.to, line.to + 1) === LINE_SEPARATOR
              ? line.text + LINE_SEPARATOR
              : line.text,
          type: lineTypeGraph[values[i]?.type ?? 'unset'][type],
        };
      }
    });

    return values;
  },
});
