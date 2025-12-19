import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function hasLineWrapping(lineWrapping: boolean): Extension {
  //Reconfigure the view to toggle line wrapping
  return lineWrapping ? EditorView.lineWrapping : [];
}
