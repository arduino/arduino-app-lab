import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { contentToText } from './utils';

describe('contentToText', () => {
  // createUseCodeMirrorHook decides whether a cached EditorState is still
  // valid by comparing its doc against the content store's string. That
  // comparison must treat line endings the way EditorState.create does —
  // a split('\n') kept the \r on every line of a CRLF file, so the cached
  // state (cursor, scroll position) was discarded on every tab switch on
  // Windows.
  it.each([
    ['LF', 'line one\nline two\nline three'],
    ['CRLF', 'line one\r\nline two\r\nline three'],
    ['CR', 'line one\rline two\rline three'],
    ['mixed', 'line one\r\nline two\nline three'],
  ])(
    'matches the doc EditorState.create builds from the same string (%s)',
    (_label, content) => {
      const stateDoc = EditorState.create({ doc: content }).doc;
      expect(contentToText(content).eq(stateDoc)).toBe(true);
    },
  );

  it('does not equate content that genuinely differs', () => {
    const stateDoc = EditorState.create({ doc: 'a\r\nb' }).doc;
    expect(contentToText('a\r\nc').eq(stateDoc)).toBe(false);
  });
});
