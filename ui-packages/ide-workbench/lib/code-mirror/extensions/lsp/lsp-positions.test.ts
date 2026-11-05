import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { toDocOffset } from './lsp-positions';

/**
 * A server's positions are not always inside the document. The Arduino LS maps
 * clang-format's edits back from a preprocessed .cpp and reports the sketch's
 * final newline as the start of the line *after* the .ino's last one;
 * `doc.line()` throws a RangeError on that, which is how a whole formatting
 * response used to be lost. So every branch here is a clamp, not a lookup —
 * `lspFormat` covers the past-the-end case end to end, these pin the edges
 * directly.
 */
const DOC = Text.of(['void setup() {', '  pinMode(13, OUTPUT);', '}']);

describe('toDocOffset', () => {
  it('resolves a position inside the document', () => {
    const offset = toDocOffset(DOC, { line: 1, character: 2 });

    expect(DOC.sliceString(offset, offset + 7)).toBe('pinMode');
  });

  it('clamps a character past the end of its line to that line, not the next', () => {
    expect(toDocOffset(DOC, { line: 0, character: 999 })).toBe(DOC.line(1).to);
  });

  it('reads a line past the last one as the end of the document', () => {
    expect(toDocOffset(DOC, { line: DOC.lines, character: 0 })).toBe(
      DOC.length,
    );
  });

  it('reads a negative line as the start of the document', () => {
    expect(toDocOffset(DOC, { line: -1, character: 4 })).toBe(0);
  });

  it('reads a negative character as the start of its line', () => {
    expect(toDocOffset(DOC, { line: 1, character: -5 })).toBe(DOC.line(2).from);
  });
});
