import { EditorView, getDialog, showDialog } from '@codemirror/view';

export const LSP_RENAME_PANEL_CLASS = 'cm-lsp-rename-panel';

const MESSAGE_CLASS = 'cm-lsp-rename-message';
const MESSAGE_ERROR_CLASS = 'cm-lsp-rename-message-error';

interface RenamePanelParams {
  /** Symbol name the panel opens with, selected so it can be overtyped. */
  currentName: string;
  /** Accessible name for the input (the panel shows no label text). */
  inputLabel: string;
  /** Shown under the input while the typed name is acceptable. */
  hint: string;
  /** Error to show in place of the hint, or null to accept `newName`. */
  validate: (newName: string) => string | null;
  onSubmit: (newName: string) => void;
}

/**
 * The rename prompt. Replaces @codemirror/lsp-client's `renameSymbol` dialog so
 * an invalid name can be reported and corrected in place: the library submits
 * (and closes) on Enter unconditionally, and a name the server refuses then
 * comes back as an empty edit, i.e. as nothing happening at all.
 */
export const openLspRenamePanel = ({
  view,
  ...params
}: RenamePanelParams & { view: EditorView }): void => {
  const openPanel = getDialog(view, LSP_RENAME_PANEL_CLASS);
  if (openPanel) {
    // Already prompting (rename pressed again): restart from the symbol now
    // under the cursor.
    selectInput(openPanel.dom, params.currentName);
  } else {
    showDialog(view, {
      class: LSP_RENAME_PANEL_CLASS,
      focus: true,
      content: (_view, close) => renamePanelContent({ ...params, close }),
    });
  }

  // When triggered from the context menu, the menu steals focus from the rename
  // input when it closes.
  setTimeout(() => {
    const panel = getDialog(view, LSP_RENAME_PANEL_CLASS);
    if (panel) {
      selectInput(panel.dom);
    }
  }, 50);
};

const selectInput = (panelDom: HTMLElement, value?: string): void => {
  const input = panelDom.querySelector('input');
  if (!input) {
    return;
  }
  if (value !== undefined) {
    input.value = value;
  }
  input.select();
};

/**
 * Note this builds no `<form>` element on purpose: CodeMirror's dialog wires
 * Enter and submit on any form it finds to "resolve and close", which would
 * discard an invalid name. Enter and Escape are handled here instead, so the
 * panel only closes once the name passes validation (or the user gives up).
 */
const renamePanelContent = ({
  currentName,
  inputLabel,
  hint,
  validate,
  onSubmit,
  close,
}: RenamePanelParams & { close: () => void }): HTMLElement => {
  const content = document.createElement('div');
  content.className = 'cm-lsp-rename-content';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'name';
  input.className = 'cm-lsp-rename-input cm-textfield';
  input.value = currentName;
  input.setAttribute('aria-label', inputLabel);

  const message = document.createElement('div');
  message.className = MESSAGE_CLASS;
  message.textContent = hint;
  message.setAttribute('aria-live', 'polite');

  const setMessage = (text: string, isError: boolean): void => {
    message.textContent = text;
    message.classList.toggle(MESSAGE_ERROR_CLASS, isError);
    input.setAttribute('aria-invalid', String(isError));
  };

  input.addEventListener('input', () => setMessage(hint, false));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();

    const newName = input.value.trim();
    const error = validate(newName);
    if (error) {
      setMessage(error, true);
      return;
    }
    close();
    onSubmit(newName);
  });

  content.append(input, message);
  return content;
};
