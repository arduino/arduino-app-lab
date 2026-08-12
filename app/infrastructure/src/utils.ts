import { AppDetailedInfo, AppStatus } from './orchestrator-api';

// App names are display text, not path components: the orchestrator derives the
// directory with slug.Make(name) (see findAppPathByName), so "My Awesome App"
// becomes my-awesome-app and even "app; rm -rf ~" becomes app-rm-rf. Neither the
// board shell nor the host filesystem ever sees the raw name, so the rules below
// deliberately do NOT apply here — this one only keeps display names tame and
// avoids two names slugging to the same directory.
export const APP_NAME_INVALID_CHARACTERS_REGEX = /[^a-zA-Z0-9._ -]/;

// Files and folders are the opposite case: their names ARE path components,
// used verbatim. What has to be excluded is narrower than it looks, because the
// transports do quote paths for file operations (`cat %q` on SSH,
// strconv.Quote on ADB in the pinned arduino-app-cli). So spaces and most shell
// metacharacters are perfectly fine — "my notes.txt", "notes (draft) v2.md".
//
// What is left:
//   - '$' and '`'. The transports quote with DOUBLE quotes, and POSIX sh still
//     expands both inside those. Verified against a board: a filename holding
//     `echo INJECTED` in backticks ran it, and one holding $HOME expanded it.
//   - '<' '>' ':' '"' '|' '?' '*' '\\', trailing dots/spaces, and reserved
//     device names. Nothing to do with the shell: InitLspWorkspace mirrors app
//     files onto the host, Windows is a supported host, and one unwritable name
//     used to abort the whole mirror.
//   - '/' and control characters, unusable in a name anywhere.
//
// Mirrored in Go by expansionUnsafe/windowsUnsafe/controlChars in
// app-lab-desktop's fs/watcher, which is the enforcing copy (this one is
// bypassable). There is a stricter `shellUnsafe` there too, but it only gates
// watch *roots* (app directories, which the orchestrator slugs anyway) because
// the inotifywait argv is unquoted. Files inside a watched app are covered by
// inotifywait's -r and never appear as an argument, so a name allowed here is
// fully watched — spaces included.
export const FILE_NAME_INVALID_CHARACTERS_REGEX =
  // eslint-disable-next-line no-control-regex
  /[$`/\\<>:"|?*\x00-\x1f]/;

// Trailing dots or spaces are silently stripped or rejected on Windows.
export const TRAILING_DOTS_OR_SPACES = /[. ]+$/;

// Windows reserved device names, with or without an extension.
export const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Whether `name` is usable as a single path component — no separators, safe in
 * the board shell, and writable on a Windows host. Use this rather than testing
 * the regexes individually: every caller needs all four checks, and three of
 * them were previously easy to forget.
 */
export function isValidResourceName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed !== '' &&
    !FILE_NAME_INVALID_CHARACTERS_REGEX.test(trimmed) &&
    !TRAILING_DOTS_OR_SPACES.test(trimmed) &&
    !RESERVED_NAMES.test(trimmed)
  );
}

export const ORGANIZATION_HEADER = 'X-Organization';
const CLASSROOM_SHARE_URL = 'https://classroom.google.com/u/0/share';

export const STATUSES_WHERE_RENAME_ALLOWED = [
  'stopped',
  'failed',
  'uninitialized',
] as const;

export const STATUSES_WHERE_RENAME_FORBIDDEN = [
  'starting',
  'running',
  'stopping',
] as const;

export function createUUID(): string {
  let dt = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
}

export function buildShareToClassroomURL(
  target: URL,
  title: string,
  body: string,
): string {
  return `
  ${CLASSROOM_SHARE_URL}?url=${encodeURIComponent(
    target.toString(),
  )}&title=${title}&body=${body}
  `;
}

export function canRenameApp(
  app: AppDetailedInfo | undefined,
  appStatus: AppStatus | undefined,
): boolean {
  return (
    !app?.example &&
    appStatus != null &&
    STATUSES_WHERE_RENAME_ALLOWED.includes(
      appStatus as typeof STATUSES_WHERE_RENAME_ALLOWED[number],
    )
  );
}
