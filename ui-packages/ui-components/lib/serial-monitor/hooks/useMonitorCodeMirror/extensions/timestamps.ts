import { Compartment, Extension } from '@codemirror/state';
import { EditorView, gutter, GutterMarker, ViewUpdate } from '@codemirror/view';

import { trackedData } from './trackData';

export function buildTimestamp(source?: number): string {
  const date = source ? new Date(source) : new Date();
  return date.toLocaleTimeString() + '.' + date.getMilliseconds();
}

class Timestamp extends GutterMarker {
  timestamp: string;
  constructor(timestamp: string) {
    super();
    this.timestamp = timestamp;
  }

  toDOM(): Text {
    return document.createTextNode(this.timestamp);
  }
}

const timestampGutter = gutter({
  lineMarker(view, block) {
    const lineN = view.state.doc.lineAt(block.from).number;
    const value = view.state.field(trackedData)[lineN];

    if (!value) {
      return null;
    }

    return new Timestamp(value.timestamp);
  },
  initialSpacer: () => new Timestamp(buildTimestamp()),
});

const timestampsCompartment = new Compartment();

export const timestamps = (cb: (value: boolean) => void): Extension => [
  timestampsCompartment.of([]),
  EditorView.updateListener.of((update: ViewUpdate) => {
    for (const tr of update.transactions) {
      if (tr.reconfigured) {
        const timestamps = timestampsCompartment.get(tr.state);
        if (Array.isArray(timestamps) && timestamps.length === 0) {
          cb(false);
        } else if (timestamps === timestampGutter) {
          cb(true);
        }
      }
    }
  }),
];

export function toggleTimestamps(view: EditorView): void {
  const currentExt = timestampsCompartment.get(view.state);

  if (Array.isArray(currentExt) && currentExt.length === 0) {
    view.dispatch({
      effects: timestampsCompartment.reconfigure(timestampGutter),
    });
  } else {
    view.dispatch({
      effects: timestampsCompartment.reconfigure([]),
    });
  }
}
