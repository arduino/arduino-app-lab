/**
 * What a link in agent output resolves to. No branch may navigate: the desktop host answers an unknown
 * path with index.html, so a plain `<a href="my-app/main.py">` full-reloads the SPA and kills the
 * mounted chat panel and the running turn.
 */
export type LinkTarget =
  // Handed to the OS, so the webview itself never follows it.
  | { kind: 'external'; url: string }
  // A file in an agent app mirror; `path` stays as written and Go resolves it in AgentResolveFile.
  | { kind: 'file'; path: string }
  // Nothing to act on: data:, javascript:, protocol-relative //host, a bare #fragment.
  | { kind: 'inert' };

// Schemes worth handing to the OS: browser for http(s), mail client for mailto, dialer for tel.
// These are also the only four react-markdown's sanitizer lets through, so nothing else arrives.
const EXTERNAL = /^(?:https?|mailto|tel):/i;
const FILE_URL = /^file:\/\//i;
// 'www.arduino.cc' — a scheme-less URL, which agents write often enough to be worth reading as one.
const BARE_WWW = /^www\./i;
// 'C:\src\main.py' — a Windows path, not a scheme, despite the colon.
const DRIVE = /^[a-z]:[\\/]/i;
// Any other scheme; 2+ chars before the colon so a drive letter can't match.
const SCHEME = /^[a-z][a-z0-9+.-]+:/i;

// Markdown writes a space as %20; a literal '%' throws, and the raw text is then the better guess.
const decodePath = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

// Only file:///abs and file://localhost/abs name a local file; a real host is a remote share.
const fileUrlPath = (url: string): string | undefined => {
  const rest = url.replace(FILE_URL, '').replace(/^localhost(?=\/)/i, '');
  // file://C:/app/main.py — Windows tooling emits the drive in the authority position; it's a path.
  if (DRIVE.test(rest)) {
    return decodePath(rest);
  }
  if (!rest.startsWith('/')) {
    return undefined;
  }

  const path = decodePath(rest);
  // file:///C:/app/main.py → C:/app/main.py: that leading slash is URL syntax, not part of the path.
  return DRIVE.test(path.slice(1)) ? path.slice(1) : path;
};

export const linkTarget = (href?: string): LinkTarget => {
  const url = href?.trim();
  if (!url) {
    return { kind: 'inert' };
  }

  if (EXTERNAL.test(url)) {
    return { kind: 'external', url };
  }

  if (FILE_URL.test(url)) {
    const path = fileUrlPath(url);
    return path ? { kind: 'file', path } : { kind: 'inert' };
  }

  // 'arduino.cc/docs' stays ambiguous against 'my-app/main.py', but a 'www.' prefix names no file.
  if (BARE_WWW.test(url)) {
    return { kind: 'external', url: `https://${url}` };
  }

  // '//host/x' is a real navigation and '#x' names nothing — our headings carry no ids.
  if (
    !DRIVE.test(url) &&
    (SCHEME.test(url) || url.startsWith('//') || url.startsWith('#'))
  ) {
    return { kind: 'inert' };
  }

  // What's left is a path; a trailing '#L20' or query is a hint for a human, not part of the name.
  const path = decodePath(url.split(/[?#]/)[0] ?? '');
  return path ? { kind: 'file', path } : { kind: 'inert' };
};
