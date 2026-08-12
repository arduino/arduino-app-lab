/**
 * A rename target the server refuses is answered with an empty edit — the
 * rename simply appears to do nothing — so the panel validates the name before
 * sending it. The rules are per-language: `$` is a normal identifier character
 * in JS/TS but not in Python or C++, so the same name can't be judged globally.
 */

import { describe, expect, it } from 'vitest';

import { messages } from '../../../messages';
import { validateRenameName } from './lsp-rename-validation';

const PY_URI = 'file:///ws/app/python/main.py';
const INO_URI = 'file:///ws/app/sketch/sketch.ino';
const TS_URI = 'file:///ws/app/web/index.ts';
const CSS_URI = 'file:///ws/app/web/style.css';

describe('validateRenameName', () => {
  it('rejects an empty name', () => {
    expect(validateRenameName({ newName: '', uri: PY_URI })).toEqual({
      message: messages.renameNameRequired,
    });
  });

  it('accepts a plain identifier in every language', () => {
    for (const uri of [PY_URI, INO_URI, TS_URI, CSS_URI]) {
      expect(validateRenameName({ newName: 'my_symbol2', uri })).toBeNull();
    }
  });

  it('rejects `$` in Python and C++ but accepts it in JS/TS', () => {
    expect(validateRenameName({ newName: '$bad', uri: PY_URI })).toEqual({
      message: messages.renameNameInvalid,
      values: { name: '$bad' },
    });
    expect(
      validateRenameName({ newName: '$bad', uri: INO_URI }),
    ).not.toBeNull();
    expect(validateRenameName({ newName: '$ok', uri: TS_URI })).toBeNull();
  });

  it('rejects names that cannot start an identifier', () => {
    expect(
      validateRenameName({ newName: '2fast', uri: PY_URI }),
    ).not.toBeNull();
    expect(validateRenameName({ newName: 'a-b', uri: TS_URI })).not.toBeNull();
    expect(
      validateRenameName({ newName: 'foo bar', uri: INO_URI }),
    ).not.toBeNull();
  });

  it('accepts unicode letters where the language does', () => {
    expect(validateRenameName({ newName: 'café', uri: PY_URI })).toBeNull();
    expect(validateRenameName({ newName: 'café', uri: TS_URI })).toBeNull();
    // C++ identifiers stay ASCII-only.
    expect(
      validateRenameName({ newName: 'café', uri: INO_URI }),
    ).not.toBeNull();
  });

  it('only rejects the impossible for languages without identifier rules', () => {
    // css/html and anything the LSP language map doesn't cover: the server
    // decides, we filter out names that can't work anywhere.
    expect(
      validateRenameName({ newName: '--my-var', uri: CSS_URI }),
    ).toBeNull();
    expect(
      validateRenameName({ newName: 'two words', uri: CSS_URI }),
    ).not.toBeNull();
  });
});
