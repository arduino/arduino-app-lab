import { Diagnostic, linter } from '@codemirror/lint';
import { Extension } from '@codemirror/state';
import { parseDocument, YAMLError } from 'yaml';

// The Lezer grammar accepts tabs, bad quotes and duplicate keys silently, so diagnostics need a real parse.
export const yamlLint: Extension = linter((view) => {
  const end = view.state.doc.length;

  const toDiagnostic = (
    { pos, message }: YAMLError,
    severity: Diagnostic['severity'],
  ): Diagnostic => ({
    from: Math.min(pos[0], end),
    to: Math.min(Math.max(pos[1], pos[0] + 1), end),
    severity,
    message,
  });

  try {
    const parsed = parseDocument(view.state.doc.toString(), {
      prettyErrors: false,
    });

    return [
      ...parsed.errors.map((e) => toDiagnostic(e, 'error')),
      ...parsed.warnings.map((w) => toDiagnostic(w, 'warning')),
    ];
  } catch (e) {
    console.error(e);
    return [];
  }
});
