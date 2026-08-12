/**
 * The rename prompt replaces @codemirror/lsp-client's dialog for one reason:
 * the library submits and closes on Enter whatever was typed, and a name the
 * server refuses comes back as an empty edit — so an invalid name looked
 * exactly like nothing happening. These tests pin that a rejected name keeps
 * the panel open with the reason visible and sends nothing.
 */

import { EditorState } from '@codemirror/state';
import { EditorView, getDialog } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LSP_RENAME_PANEL_CLASS, openLspRenamePanel } from './lsp-rename-panel';

const HINT = 'Enter to rename';

const views: EditorView[] = [];

afterEach(() => {
  while (views.length) {
    views.pop()?.destroy();
  }
});

const makeView = (): EditorView => {
  const view = new EditorView({
    state: EditorState.create({ doc: 'value = 1\nprint(value)' }),
    parent: document.body,
  });
  views.push(view);
  return view;
};

const open = ({
  view,
  validate = (): null => null,
  onSubmit = vi.fn(),
  currentName = 'value',
}: {
  view: EditorView;
  validate?: (newName: string) => string | null;
  onSubmit?: (newName: string) => void;
  currentName?: string;
}): void => {
  openLspRenamePanel({
    view,
    currentName,
    inputLabel: 'New name',
    hint: HINT,
    validate,
    onSubmit,
  });
};

const panelInput = (view: EditorView): HTMLInputElement =>
  view.dom.querySelector('.cm-lsp-rename-input') as HTMLInputElement;

const panelMessage = (view: EditorView): HTMLElement =>
  view.dom.querySelector('.cm-lsp-rename-message') as HTMLElement;

const isPanelOpen = (view: EditorView): boolean =>
  getDialog(view, LSP_RENAME_PANEL_CLASS) !== null;

const type = (input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const pressKey = (input: HTMLInputElement, key: string): void => {
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
};

// The dialog closes on a microtask queued by showDialog's result promise.
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('openLspRenamePanel', () => {
  it('opens prefilled with the current name and the hint', () => {
    const view = makeView();
    open({ view });

    expect(panelInput(view).value).toBe('value');
    expect(panelMessage(view).textContent).toBe(HINT);
  });

  it('keeps the panel open and shows why when the name is rejected', async () => {
    const view = makeView();
    const onSubmit = vi.fn();
    open({
      view,
      validate: (newName) => (newName === '$bad' ? 'not a valid name' : null),
      onSubmit,
    });

    const input = panelInput(view);
    type(input, '$bad');
    pressKey(input, 'Enter');
    await settle();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(isPanelOpen(view)).toBe(true);
    expect(panelMessage(view).textContent).toBe('not a valid name');
    expect(panelMessage(view).classList).toContain(
      'cm-lsp-rename-message-error',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('lets a rejected name be corrected in place', async () => {
    const view = makeView();
    const onSubmit = vi.fn();
    open({
      view,
      validate: (newName) => (newName === '$bad' ? 'not a valid name' : null),
      onSubmit,
    });

    const input = panelInput(view);
    type(input, '$bad');
    pressKey(input, 'Enter');
    // Editing clears the error, so the panel doesn't keep showing a stale one.
    type(input, 'total');
    expect(panelMessage(view).textContent).toBe(HINT);

    pressKey(input, 'Enter');
    await settle();

    expect(onSubmit).toHaveBeenCalledWith('total');
    expect(isPanelOpen(view)).toBe(false);
  });

  it('submits the trimmed name and closes', async () => {
    const view = makeView();
    const onSubmit = vi.fn();
    open({ view, onSubmit });

    const input = panelInput(view);
    type(input, '  total  ');
    pressKey(input, 'Enter');
    await settle();

    expect(onSubmit).toHaveBeenCalledWith('total');
    expect(isPanelOpen(view)).toBe(false);
  });

  it('closes without renaming on Escape', async () => {
    const view = makeView();
    const onSubmit = vi.fn();
    open({ view, onSubmit });

    const input = panelInput(view);
    type(input, 'total');
    pressKey(input, 'Escape');
    await settle();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(isPanelOpen(view)).toBe(false);
  });

  it('restarts an open panel from the symbol now under the cursor', () => {
    const view = makeView();
    open({ view });
    type(panelInput(view), 'half-typed');

    open({ view, currentName: 'other' });

    expect(view.dom.querySelectorAll('.cm-lsp-rename-input')).toHaveLength(1);
    expect(panelInput(view).value).toBe('other');
  });
});
