import { getCSSVariable, setCSSVariable } from '@cloud-editor-mono/common';
import { Extension } from '@codemirror/state';
import { gutter, GutterMarker } from '@codemirror/view';

import styleVars from '../code-editor-variables.module.scss';

class NumberMarker extends GutterMarker {
  constructor(readonly number: string) {
    super();
  }

  toDOM(): Node {
    return document.createTextNode(this.number);
  }
}

export const createCustomLineNumberGutter = (
  lineNumberStartOffset = 0,
  fontSize: number = Number(styleVars.defaultFontSize),
): Extension =>
  gutter({
    class: 'cm-lineNumbers',
    lineMarker(view, line) {
      return new NumberMarker(
        (
          Number(view.state.doc.lineAt(line.from).number) +
          lineNumberStartOffset
        ).toString(),
      );
    },
    initialSpacer(view) {
      return new NumberMarker(view.state.doc.lines.toString());
    },
    updateSpacer(spacer, update) {
      const defaultFontSize = Number(getCSSVariable(styleVars.defaultFontSize));
      const currentFontSize = fontSize;
      const lineNumberDigits = update.view.state.doc.lines.toString().length;
      const defaultGutterWidth = Number(
        styleVars.defaultLineNumbersGutterWidth,
      );

      // The minimum width of the line numbers gutter is 30px.
      // If the number of digits greater than 3, the width of the gutter will be 10px for each digit + 10px.
      const gutterWidthCalc =
        Math.max(lineNumberDigits * 10 + 10, defaultGutterWidth) +
        currentFontSize -
        defaultFontSize;
      const currentLineNumbersGutterWidth = Number(
        getCSSVariable(styleVars.lineNumbersGutterWidth),
      );

      if (
        gutterWidthCalc >= defaultGutterWidth &&
        gutterWidthCalc !== currentLineNumbersGutterWidth
      ) {
        setCSSVariable(styleVars.lineNumbersGutterWidth, `${gutterWidthCalc}`);
      }

      return spacer;
    },
  });
