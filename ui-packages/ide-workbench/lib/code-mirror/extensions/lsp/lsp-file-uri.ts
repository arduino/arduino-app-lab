/**
 * The single place file URIs are built, taken apart, and compared.
 *
 * Two rules keep this consistent with the Go side (internal/lsp/lsp_workspace.go):
 *
 *  - Never build a URI by concatenation. `toFileUri` and `joinFileUri` are the
 *    only producers; they percent-encode every segment, so a path containing
 *    "#", "?", "%" or a space survives the trip through a language server's
 *    RFC 3986 parser instead of being truncated at a fragment.
 *  - Never compare URIs with `===` or `startsWith`. `normalizeFileUri`,
 *    `isWithinUri` and `relativeUriPath` decode first so that differently
 *    encoded spellings of one path compare equal.
 */

/**
 * A decoded URI naming a Windows location — either a drive ("file:///C:/x") or
 * a UNC share ("file://server/x"). Neither shape occurs on macOS/Linux, so this
 * stands in for the Go side's `runtime.GOOS == "windows"` check; both must fold
 * the same set of URIs or the two disagree about what is inside the workspace.
 */
const windowsUri = /^file:\/\/(?:\/[A-Za-z]:|[^/])/;

// RFC 3986 allows ":" and "@" unescaped inside a path segment, but
// encodeURIComponent escapes them anyway. Restoring them keeps drive letters
// readable ("C:" not "C%3A") and matches what Go's url.PathEscape emits.
const encodeSegment = (segment: string): string =>
  encodeURIComponent(segment).replace(/%3A/gi, ':').replace(/%40/g, '@');

/**
 * Build a file URI from a native path. Accepts Windows (`C:\x`, `\\server\share`)
 * and posix (`/home/me/x`) forms.
 */
export const toFileUri = (path: string): string => {
  const slashed = path.replace(/\\/g, '/');

  // A UNC path is an authority, not a fourth slash: "\\server\share\x" has to
  // become "file://server/share/x" for a URI parser to read the host back out.
  if (slashed.startsWith('//')) {
    const [, , host, ...rest] = slashed.split('/');
    const tail = rest.map(encodeSegment).join('/');
    return `file://${encodeSegment(host)}${tail ? `/${tail}` : ''}`;
  }

  const absolute = slashed.startsWith('/') ? slashed : `/${slashed}`;
  return `file://${absolute.split('/').map(encodeSegment).join('/')}`;
};

/** Append a `/`-separated relative path to a URI, encoding each segment. */
export const joinFileUri = (baseUri: string, relativePath: string): string => {
  const tail = relativePath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(encodeSegment)
    .join('/');
  return tail ? `${baseUri.replace(/\/+$/, '')}/${tail}` : baseUri;
};

/**
 * Decode a file URI's percent-escapes, preserving case. Use this when the
 * result is a *value* (e.g. a file id handed to the editor); use
 * `normalizeFileUri` when the result is only compared or used as a map key.
 */
export const decodeFileUri = (uri: string): string =>
  // Decode percent-encoding so equivalently-encoded URIs compare equal (e.g.
  // "%20" and a literal space), while leaving encoded path separators ("%2F")
  // intact so two distinct paths never collapse to the same lookup key.
  uri
    .split(/(%2f)/i)
    .map((part) => {
      // Emit one canonical spelling: "%2F" and "%2f" name the same path and
      // must not produce two different keys.
      if (part.toLowerCase() === '%2f') {
        return '%2F';
      }
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join('');

/**
 * Canonical comparison key for a file URI. Never use the result as a path or
 * file id — on Windows it is case-folded and won't match the real name.
 */
export const normalizeFileUri = (uri: string): string => {
  const decoded = decodeFileUri(uri);
  // Windows filesystems are case-insensitive, so fold the whole URI, not just
  // the drive letter — a server that lowercases path segments must still match.
  // Mirrors isWithinDir in the Go side's lsp_workspace.go; keep the two in sync.
  return windowsUri.test(decoded) ? decoded.toLowerCase() : decoded;
};

/**
 * True when `uri` resolves to `baseUri` itself or a descendant of it. Matches
 * only on a real path boundary so a sibling dir sharing the prefix (".../ws"
 * vs ".../ws-extra") is not misclassified as inside.
 */
export const isWithinUri = (uri: string, baseUri: string): boolean => {
  const normalizedBase = normalizeFileUri(baseUri);
  const normalized = normalizeFileUri(uri);
  return (
    normalized === normalizedBase || normalized.startsWith(`${normalizedBase}/`)
  );
};

/**
 * The path of `uri` relative to `baseUri`, decoded for use as a file id, or
 * null when `uri` is not inside `baseUri`.
 */
export const relativeUriPath = (
  uri: string,
  baseUri: string,
): string | null => {
  const prefix = `${normalizeFileUri(baseUri)}/`;
  if (!normalizeFileUri(uri).startsWith(prefix)) {
    return null;
  }
  // Slice the case-preserving decode, not the case-folded key: the result is a
  // path. Both forms decode identically, so the prefix length is the same.
  return decodeFileUri(uri).slice(prefix.length);
};
