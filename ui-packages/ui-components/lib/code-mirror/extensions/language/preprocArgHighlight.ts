import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';

import styles from '../../../../public/shared.module.scss';

/**
 * @lezer/cpp has 2 bugs:
 * Capitalization bug — @lezer/cpp's highlight rules map PreProcArg (capital P)
 * to a comment style, but the actual AST node is named PreprocArg (lowercase p),
 * so the style is never applied.
 * Grammar bug — Inside PreprocArg nodes, // comments are consumed as raw text
 * rather than being split into a LineComment node, so standard comment
 * highlighting doesn't reach them.
 *
 * This plugin handles both issues by
 * walking the tree and coloring `//` comments inside PreprocArg nodes.
 */
const commentMark = Decoration.mark({ class: 'cm-preproc-arg-comment' });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  const { from, to } = view.viewport;

  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.name === 'PreprocArg') {
        const text = view.state.sliceDoc(node.from, node.to);
        const idx = text.indexOf('//');
        if (idx !== -1) {
          builder.add(node.from + idx, node.to, commentMark);
        }
        return false;
      }
    },
  });

  return builder.finish();
}

export const preprocArgCommentHighlight = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (instance) => instance.decorations },
  ),
  EditorView.baseTheme({
    '.cm-preproc-arg-comment': {
      color: `${styles.editorSyntaxHighlightComments} !important`,
    },
  }),
];
