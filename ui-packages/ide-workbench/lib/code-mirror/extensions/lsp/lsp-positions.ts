import { Text } from '@codemirror/state';

import { LspPosition } from './lsp-types';

/**
 * The offset in `doc` that an LSP position points at, clamped to the document
 * instead of trusting the server to stay inside it.
 *
 * The Arduino LS maps clang-format's edits back from the preprocessed .cpp,
 * which carries the sketch plus the lines the preprocessor added. An edit whose
 * end falls on the first of those added lines — which is what clang-format
 * sends for the sketch's final newline — is reported as the start of the line
 * *after* the sketch's last one (the sketch mapper's "END LINE ADJUSTED" case,
 * `CppToInoRangeOk`), one line past the end of the .ino. @codemirror/lsp-client
 * converts positions with `doc.line()`, which throws a RangeError on that, and
 * the throw took the whole response with it: formatting a sketch raised an
 * unhandled rejection and applied nothing at all, not even the edits that were
 * in range.
 *
 * A position past the last line therefore means the end of the document, which
 * is exactly what the server was describing.
 */
export const toDocOffset = (doc: Text, pos: LspPosition): number => {
  if (pos.line < 0) {
    return 0;
  }
  if (pos.line >= doc.lines) {
    return doc.length;
  }
  const line = doc.line(pos.line + 1);
  return line.from + Math.min(Math.max(pos.character, 0), line.length);
};
