/**
 * The references panel's key bindings, over a real `EditorView`.
 *
 * Escape is shared property: the references panel, the find-and-replace panel
 * and the language autocomplete all want it. This keymap claims it only when a
 * panel was actually closed — `closeLspReferences?.() ?? false` — and CodeMirror
 * stops at the first handler that returns true, so answering `true` with nothing
 * open would swallow the key from every binding registered behind this one.
 * These tests pin that hand-off from both sides, which no other suite covers:
 * `lsp-references` tests the resolution, `lsp-client-commands` the search, and
 * the store test the boolean in isolation.
 */

import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FormatMessage } from '../../../../../../i18n/useI18n';
import { getLspClientKeymapExtension } from './lsp-client-keymap-extension';

const formatMessage: FormatMessage = (descriptor) =>
  String(descriptor.defaultMessage ?? '');

const views: EditorView[] = [];

afterEach(() => {
  while (views.length) {
    views.pop()?.destroy();
  }
});

/**
 * A view holding the LSP keymap ahead of a probe binding for the same key,
 * mirroring the production order: the search compartment and the language
 * extensions are pushed after the LSP extension in `createState`, so they see a
 * key only once the LSP keymap has declined it.
 */
const mountView = (
  closeLspReferences?: () => boolean,
): { view: EditorView; fellThrough: () => void } => {
  const fellThrough = vi.fn();

  const view = new EditorView({
    state: EditorState.create({
      doc: 'add(1, 2)',
      extensions: [
        getLspClientKeymapExtension({
          formatMessage,
          showLspReferences: vi.fn(),
          closeLspReferences,
        }),
        keymap.of([
          {
            key: 'Escape',
            run: (): boolean => {
              fellThrough();
              return true;
            },
          },
        ]),
      ],
    }),
    parent: document.body,
  });
  views.push(view);

  return { view, fellThrough };
};

const press = (view: EditorView, key: string): void => {
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true }),
  );
};

describe('getLspClientKeymapExtension', () => {
  it('closes the panel on Escape and keeps the key from the bindings behind it', () => {
    const closeLspReferences = vi.fn(() => true);
    const { view, fellThrough } = mountView(closeLspReferences);

    press(view, 'Escape');

    expect(closeLspReferences).toHaveBeenCalledTimes(1);
    expect(fellThrough).not.toHaveBeenCalled();
  });

  it('lets Escape through when there was no panel to close', () => {
    const closeLspReferences = vi.fn(() => false);
    const { view, fellThrough } = mountView(closeLspReferences);

    press(view, 'Escape');

    expect(closeLspReferences).toHaveBeenCalledTimes(1);
    // What leaves the find-and-replace panel and the autocomplete closable.
    expect(fellThrough).toHaveBeenCalledTimes(1);
  });

  it('lets Escape through when the app wired no panel at all', () => {
    // The LSP-disabled branch of `useLSP` hands down no actions.
    const { view, fellThrough } = mountView(undefined);

    press(view, 'Escape');

    expect(fellThrough).toHaveBeenCalledTimes(1);
  });

  it('dismisses the panel before starting a rename', () => {
    // A rename rewrites the very text the rows point at, so the panel goes
    // first — F2 without an LSP client still gets that far.
    const closeLspReferences = vi.fn(() => true);
    const { view } = mountView(closeLspReferences);

    press(view, 'F2');

    expect(closeLspReferences).toHaveBeenCalledTimes(1);
  });
});
