/**
 * Unit tests for the file-URI chokepoint shared by the LSP client.
 *
 * Coverage:
 *  - toFileUri / joinFileUri (the only two producers; segment encoding)
 *  - decodeFileUri (percent-escapes, %2F canonicalisation, malformed input)
 *  - normalizeFileUri (case folding, encoded drive colon)
 *  - isWithinUri / relativeUriPath (path-boundary matching)
 *
 * These rules have to agree with the Go side (isWithinDir / FileURIToLocalPath
 * / IsURIWithinDir in internal/lsp/lsp_workspace.go); the cases below pin the
 * shared contract, in particular that a path containing "#", "?" or "%"
 * survives encoding rather than being truncated by an RFC 3986 parser.
 */

import { describe, expect, it } from 'vitest';

import {
  decodeFileUri,
  isWithinUri,
  joinFileUri,
  normalizeFileUri,
  relativeUriPath,
  toFileUri,
} from './lsp-file-uri';

describe('toFileUri', () => {
  it('converts a Windows path to a drive-letter URI, colon unescaped', () => {
    expect(toFileUri('C:\\Users\\Me\\ws')).toBe('file:///C:/Users/Me/ws');
  });

  it('keeps an already-absolute posix path', () => {
    expect(toFileUri('/home/me/ws')).toBe('file:///home/me/ws');
  });

  it('percent-encodes characters an RFC 3986 parser would misread', () => {
    expect(toFileUri('C:\\Users\\J#n\\ws')).toBe('file:///C:/Users/J%23n/ws');
    expect(toFileUri('/home/me/a?b')).toBe('file:///home/me/a%3Fb');
    expect(toFileUri('/home/me/100% ws')).toBe('file:///home/me/100%25%20ws');
  });

  it('renders a UNC path as an authority, not a fourth slash', () => {
    expect(toFileUri('\\\\fileserver\\team\\ws')).toBe(
      'file://fileserver/team/ws',
    );
  });

  it('round-trips through decode', () => {
    expect(decodeFileUri(toFileUri('C:\\Users\\J#n\\100% ws'))).toBe(
      'file:///C:/Users/J#n/100% ws',
    );
  });
});

describe('joinFileUri', () => {
  it('encodes each appended segment', () => {
    expect(joinFileUri('file:///home/me/ws', 'src/my file.py')).toBe(
      'file:///home/me/ws/src/my%20file.py',
    );
  });

  it('does not encode the separator between segments', () => {
    expect(joinFileUri('file:///home/me/ws', 'a/b/c.py')).toBe(
      'file:///home/me/ws/a/b/c.py',
    );
  });

  it('tolerates redundant slashes and an empty relative path', () => {
    expect(joinFileUri('file:///home/me/ws/', '/src//a.py')).toBe(
      'file:///home/me/ws/src/a.py',
    );
    expect(joinFileUri('file:///home/me/ws', '')).toBe('file:///home/me/ws');
  });
});

describe('decodeFileUri', () => {
  it('decodes percent-escapes but preserves case', () => {
    expect(decodeFileUri('file:///C:/ws/My%20File.py')).toBe(
      'file:///C:/ws/My File.py',
    );
  });

  it('canonicalises %2F casing without decoding it to a separator', () => {
    expect(decodeFileUri('file:///c:/ws/a%2fb.py')).toBe(
      'file:///c:/ws/a%2Fb.py',
    );
    expect(decodeFileUri('file:///c:/ws/a%2Fb.py')).toBe(
      'file:///c:/ws/a%2Fb.py',
    );
  });

  it('leaves malformed escapes alone rather than throwing', () => {
    expect(decodeFileUri('file:///home/me/ws/100%.txt')).toBe(
      'file:///home/me/ws/100%.txt',
    );
  });
});

describe('normalizeFileUri', () => {
  it('folds the whole URI for Windows drive paths, not just the drive', () => {
    expect(normalizeFileUri('file:///C:/Users/Me/ws/A.py')).toBe(
      'file:///c:/users/me/ws/a.py',
    );
  });

  it('treats an encoded drive colon as equivalent', () => {
    expect(normalizeFileUri('file:///c%3A/Users/Me/ws/a.py')).toBe(
      normalizeFileUri('file:///C:/Users/Me/ws/a.py'),
    );
  });

  it('preserves case on posix paths, which are case-sensitive', () => {
    expect(normalizeFileUri('file:///home/me/ws/A.py')).toBe(
      'file:///home/me/ws/A.py',
    );
  });

  it('gives %2F and %2f the same key', () => {
    expect(normalizeFileUri('file:///home/me/ws/a%2Fb.py')).toBe(
      normalizeFileUri('file:///home/me/ws/a%2fb.py'),
    );
  });
});

describe('isWithinUri', () => {
  const windowsWs = toFileUri('C:\\Users\\Me\\ws');
  const posixWs = toFileUri('/home/me/ws');

  it('matches a descendant whose segment casing differs on Windows', () => {
    expect(isWithinUri('file:///c:/users/me/ws/a.py', windowsWs)).toBe(true);
    expect(isWithinUri('file:///C:/Users/Me/ws/a.py', windowsWs)).toBe(true);
  });

  it('matches the base itself', () => {
    expect(isWithinUri('file:///C:/Users/Me/ws', windowsWs)).toBe(true);
  });

  it('matches across differing encodings', () => {
    expect(isWithinUri('file:///home/me/ws/my%20file.py', posixWs)).toBe(true);
    expect(isWithinUri(joinFileUri(posixWs, 'a b/c.py'), posixWs)).toBe(true);
  });

  it('rejects a sibling directory sharing the prefix', () => {
    expect(isWithinUri('file:///C:/Users/Me/ws-extra/a.py', windowsWs)).toBe(
      false,
    );
    expect(isWithinUri('file:///home/me/ws-extra/a.py', posixWs)).toBe(false);
  });

  it('does not case-fold posix paths', () => {
    expect(isWithinUri('file:///home/me/WS/a.py', posixWs)).toBe(false);
  });

  // Go folds every path on Windows, UNC included. If this side folded only
  // drive letters the two would disagree about a UNC workspace.
  it('case-folds UNC shares, matching the Go side', () => {
    const uncWs = toFileUri('\\\\FileServer\\Team\\ws');
    expect(uncWs).toBe('file://FileServer/Team/ws');
    expect(isWithinUri('file://fileserver/team/ws/a.py', uncWs)).toBe(true);
    expect(isWithinUri('file://fileserver/team/ws-extra/a.py', uncWs)).toBe(
      false,
    );
  });
});

describe('relativeUriPath', () => {
  const posixWs = toFileUri('/home/me/ws');

  it('returns a decoded, workspace-relative path', () => {
    expect(
      relativeUriPath(joinFileUri(posixWs, 'src/my file.py'), posixWs),
    ).toBe('src/my file.py');
  });

  it('preserves case on Windows even though matching is case-folded', () => {
    const ws = toFileUri('C:\\Users\\Me\\ws');
    expect(relativeUriPath('file:///c:/users/me/ws/src/MyFile.py', ws)).toBe(
      'src/MyFile.py',
    );
  });

  it('returns null for a file outside the base', () => {
    expect(
      relativeUriPath('file:///usr/lib/python3/foo.py', posixWs),
    ).toBeNull();
    expect(
      relativeUriPath('file:///home/me/ws-extra/a.py', posixWs),
    ).toBeNull();
  });
});
