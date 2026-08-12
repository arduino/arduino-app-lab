// Backing store for "open this file in the app editor": ./openAppFileInEditor stashes the target
// here from outside the router tree (e.g. the AI assistant), the screens below read it back.
//
// Keep this module import-free. It is read from inside the route tree (appDetail.logic and
// useReloadApp), so anything it imports joins the router's own dependency graph — importing the
// router here is what the split from ./openAppFileInEditor exists to prevent. Both invariants are
// enforced by src/architecture/appLabImportCycles.test.ts, which explains the boot-time failure they
// avoid.

// The target file is stashed here and consumed once by the app-detail screen on mount (see useAppDetailLogic),
// which avoids threading a route search param through the generated router types.
let pending: { appId: string; file: string } | null = null;

// The app opened via a chip is a transient "peek": App Lab must not record it as the board's resume app (a normally-opened app still is). Cleared by useReloadApp once the user leaves it.
let peekedApp: string | null = null;

// Mark an app-relative file to auto-open once that app's editor mounts, as a peek.
export const stashAppFileToOpen = (appId: string, file: string): void => {
  pending = { appId, file };
  peekedApp = appId;
};

// True while `appId` is only being peeked (opened via a chip, not opened normally).
export const isPeekedApp = (appId: string): boolean => peekedApp === appId;

// Forget the peeked app once the user has moved on (opened another app or left the editor).
export const clearPeekedApp = (): void => {
  peekedApp = null;
};

// Read the pending file without consuming it — pure, so it's safe in a useState initializer (StrictMode double-invokes those, and a consuming read would lose the value on the second call).
export const peekPendingAppFile = (appId: string): string | undefined =>
  pending && pending.appId === appId ? pending.file : undefined;

// Consume the pending file once the app-detail screen has actually opened it.
export const clearPendingAppFile = (appId: string): void => {
  if (pending && pending.appId === appId) {
    pending = null;
  }
};
