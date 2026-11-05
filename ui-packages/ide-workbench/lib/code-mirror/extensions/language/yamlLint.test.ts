import { Diagnostic, forEachDiagnostic } from '@codemirror/lint';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileExt, fileExtCodeMirrorExtensionMap } from './setup';
import { yamlLint } from './yamlLint';

const LINT_DELAY_MS = 1000;

describe('yamlLint', () => {
  const views: EditorView[] = [];
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  const open = (doc: string, extensions: Extension): EditorView => {
    const view = new EditorView({
      state: EditorState.create({ doc, extensions }),
      parent: document.body,
    });
    views.push(view);
    return view;
  };

  const openYaml = (doc: string): EditorView =>
    open(doc, [fileExtCodeMirrorExtensionMap[FileExt.Yaml], yamlLint]);

  const lint = async (view: EditorView): Promise<Diagnostic[]> => {
    await vi.advanceTimersByTimeAsync(LINT_DELAY_MS);
    const diagnostics: Diagnostic[] = [];
    forEachDiagnostic(view.state, (d) => diagnostics.push(d));
    return diagnostics;
  };

  const expectInsideDoc = (
    view: EditorView,
    diagnostics: Diagnostic[],
  ): void => {
    expect(diagnostics.length).toBeGreaterThan(0);
    diagnostics.forEach((d) => {
      expect(d.from).toBeGreaterThanOrEqual(0);
      expect(d.to).toBeGreaterThanOrEqual(d.from);
      expect(d.to).toBeLessThanOrEqual(view.state.doc.length);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    consoleError.mockClear();
  });

  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
    vi.useRealTimers();
  });

  it('reports nothing for valid yaml', async () => {
    const view = openYaml('name: app\nbricks:\n  - id: x\n    args: [1, 2]\n');
    expect(await lint(view)).toEqual([]);
  });

  it('reports nothing for an empty document', async () => {
    const view = openYaml('');
    expect(await lint(view)).toEqual([]);
  });

  it('reports tab indentation as an error', async () => {
    const view = openYaml('a:\n\tb: 1\n');
    const diagnostics = await lint(view);
    expectInsideDoc(view, diagnostics);
    expect(diagnostics[0].severity).toBe('error');
  });

  it('reports duplicate keys', async () => {
    const view = openYaml('a: 1\na: 2\n');
    const diagnostics = await lint(view);
    expectInsideDoc(view, diagnostics);
    expect(diagnostics[0].message).toMatch(/unique/i);
  });

  it('keeps an error at the end of the document inside the document', async () => {
    const view = openYaml('a: "x');
    expectInsideDoc(view, await lint(view));
  });

  it('does not throw on unparsable input', async () => {
    const view = openYaml('\u0000{[}]: :: - -\t"\'\n%YAML 9.9\n!!!\n&a &b *c');
    await lint(view);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('clears diagnostics once the document is fixed', async () => {
    const view = openYaml('a: 1\na: 2\n');
    expect((await lint(view)).length).toBeGreaterThan(0);
    view.dispatch({ changes: { from: 5, to: 6, insert: 'b' } });
    expect(await lint(view)).toEqual([]);
  });

  it('is not part of the yaml highlighting extensions', async () => {
    const view = open(
      'a: 1\na: 2\n',
      fileExtCodeMirrorExtensionMap[FileExt.Yaml],
    );
    expect(await lint(view)).toEqual([]);
  });
});
