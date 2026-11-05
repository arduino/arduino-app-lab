import {
  ViewInstances,
  viewInstances,
} from '@cloud-editor-mono/ide-workbench/lib/code-mirror/codeMirrorViewInstances';
import type { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { EditorSelection, EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readAgentEditorContext } from './agentEditorContext';

const editor = vi.hoisted(() => ({
  contents: new Map<string, string>(),
  unsaved: new Set<string>(),
}));

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    getCodeSubjects: (): Map<string, { getValue: () => { value: string } }> =>
      new Map(
        [...editor.contents].map(([id, value]) => [
          id,
          { getValue: (): { value: string } => ({ value }) },
        ]),
      ),
    getUnsavedFilesSubject: (): BehaviorSubject<Set<string>> =>
      new BehaviorSubject(editor.unsaved),
  }),
);

const tab = (fileId: string): SelectableFileData =>
  ({
    fileId,
    fileName: fileId.split('/').pop(),
    fileExtension: fileId.includes('.') ? fileId.split('.').pop() : 'brick',
  } as SelectableFileData);

const MAIN = 'if a == True:\n    blink()\nprint("done")\n';

// The view a panel holds, with the selection the user made in it; off screen while the panel shows a preview.
const showInPanelA = (
  doc: string,
  ranges: [number, number][],
  onScreen = true,
): void => {
  viewInstances[ViewInstances.Editor].instance = {
    state: EditorState.create({
      doc,
      selection: EditorSelection.create(
        ranges.map(([from, to]) => EditorSelection.range(from, to)),
      ),
      extensions: EditorState.allowMultipleSelections.of(true),
    }),
    dom: { isConnected: onScreen },
  } as unknown as EditorView;
};

describe('readAgentEditorContext', () => {
  beforeEach(() => {
    editor.contents = new Map([
      ['python/main.py', MAIN],
      ['assets/logo.png', 'data:image/png;base64,iVBORw0KGgo='],
    ]);
    editor.unsaved = new Set(['python/main.py']);
  });

  afterEach(() => {
    viewInstances[ViewInstances.Editor].instance = null;
  });

  it('gives the file in view as the editor shows it', () => {
    expect(readAgentEditorContext('A', tab('python/main.py'))).toEqual({
      file: { path: 'python/main.py', content: MAIN, unsaved: true },
      selection: undefined,
    });
  });

  it('gives nothing for an image, a brick or no file', () => {
    expect(readAgentEditorContext('A', tab('assets/logo.png'))).toEqual({});
    expect(
      readAgentEditorContext('A', tab('arduino:object_detection')),
    ).toEqual({});
    expect(readAgentEditorContext('A', undefined)).toEqual({});
  });

  it('gives the lines selected in the file', () => {
    showInPanelA(MAIN, [[0, MAIN.indexOf('blink') + 5]]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toEqual({
      path: 'python/main.py',
      startLine: 1,
      endLine: 2,
      text: 'if a == True:\n    blink',
    });
  });

  it('does not count the line a selection ends at the start of', () => {
    showInPanelA(MAIN, [[MAIN.indexOf('    blink'), MAIN.indexOf('print')]]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toMatchObject({ startLine: 2, endLine: 2 });
  });

  // CodeMirror keeps "\n" whatever the file uses, so a Windows file must still match its view.
  it('gives the selection of a file with Windows line breaks', () => {
    editor.contents.set('python/main.py', MAIN.replace(/\n/g, '\r\n'));
    showInPanelA(MAIN, [[0, 2]]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toMatchObject({ startLine: 1, endLine: 1, text: 'if' });
  });

  // A panel showing a brick or a markdown preview keeps the view of its last text file.
  it('gives no selection when the view holds another file', () => {
    showInPanelA('void setup() {}\n', [[0, 4]]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toBeUndefined();
  });

  it('gives no selection for a bare cursor', () => {
    showInPanelA(MAIN, [[3, 3]]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toBeUndefined();
  });

  // A markdown preview takes the panel's view off screen, with the selection it had.
  it('gives no selection from a view that is off screen', () => {
    showInPanelA(MAIN, [[0, 2]], false);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toBeUndefined();
  });

  // Lines 1 and 3 without line 2: a span of 1-3 would claim a line the user never selected.
  it('gives only the main range of scattered ranges', () => {
    showInPanelA(MAIN, [
      [0, 2],
      [MAIN.indexOf('print'), MAIN.indexOf('print') + 5],
    ]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toMatchObject({ startLine: 1, endLine: 1, text: 'if' });
  });

  it('gives a column selection whole', () => {
    const blink = MAIN.indexOf('blink');
    showInPanelA(MAIN, [
      [0, 2],
      [blink, blink + 5],
    ]);

    expect(
      readAgentEditorContext('A', tab('python/main.py')).selection,
    ).toMatchObject({ startLine: 1, endLine: 2, text: 'if\nblink' });
  });

  it('sends no more of a large file than the host can embed', () => {
    editor.contents.set('data.csv', 'a'.repeat(200 * 1024));

    expect(
      readAgentEditorContext('A', tab('data.csv')).file?.content,
    ).toHaveLength(96 * 1024 + 1);
  });
});
