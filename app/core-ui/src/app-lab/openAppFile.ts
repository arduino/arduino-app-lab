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

// The editor already showing an app: a chip for it navigates to the route it is on, which remounts nothing.
const fileListeners = new Map<string, (file: string) => void>();

// Called by the app-detail screen while it is mounted, so a file for its app reaches it directly.
export const listenForAppFile = (
  appId: string,
  listener: (file: string) => void,
): (() => void) => {
  fileListeners.set(appId, listener);
  return () => {
    if (fileListeners.get(appId) === listener) {
      fileListeners.delete(appId);
    }
  };
};

// Open an app-relative file in that app's editor: at once when it is on screen, otherwise once it mounts, as a peek.
export const stashAppFileToOpen = (appId: string, file: string): void => {
  const listener = fileListeners.get(appId);
  if (listener) {
    listener(file);
    return;
  }
  pending = { appId, file };
  peekedApp = appId;
};

// True while `appId` is only being peeked (opened via a chip, not opened normally).
export const isPeekedApp = (appId: string): boolean => peekedApp === appId;

// Forget the peeked app once the user has moved on (opened another app or left the editor).
export const clearPeekedApp = (): void => {
  peekedApp = null;
};

// Same idea for the agent's "bring in a custom model" request: the brick whose model picker to open, consumed by the
// app-detail screen. It lives here rather than in its own module to stay inside the import-free half described above.
// Keyed by app because the agent can ask twice before either screen mounts, and one slot would drop the first request.
const pendingModelImports = new Map<string, string>();

// Mark a brick whose model picker should open once that app's screen mounts.
export const stashModelImport = (appId: string, brickId: string): void => {
  pendingModelImports.set(appId, brickId);
};

// Read the pending brick without consuming it (safe in a useState initializer, as above).
export const peekPendingModelImport = (appId: string): string | undefined =>
  pendingModelImports.get(appId);

// Consume it once the screen has opened the picker.
export const clearPendingModelImport = (appId: string): void => {
  pendingModelImports.delete(appId);
};

// Apps whose screen is mounted and listening for model-import events right now.
const modelImportSubscribers = new Set<string>();

// True while that app's screen will receive the event itself, so the caller need not stash and navigate.
export const isModelImportSubscribed = (appId: string): boolean =>
  modelImportSubscribers.has(appId);

// Called by the app-detail screen as it subscribes and unsubscribes.
export const setModelImportSubscribed = (appId: string, on: boolean): void => {
  if (on) {
    modelImportSubscribers.add(appId);
  } else {
    modelImportSubscribers.delete(appId);
  }
};

// App folders whose editor is mounted and moves its own tabs when the agent renames one of their files.
const agentFileRenameHandlers = new Set<string>();

// True while that app's editor follows the rename itself, so its stored tabs need nobody else.
export const isAgentFileRenameHandled = (appPath: string): boolean =>
  agentFileRenameHandlers.has(appPath);

// Called by the app-detail screen as it subscribes and unsubscribes.
export const setAgentFileRenameHandled = (
  appPath: string,
  on: boolean,
): void => {
  if (on) {
    agentFileRenameHandlers.add(appPath);
  } else {
    agentFileRenameHandlers.delete(appPath);
  }
};

// The app whose screen opens with the agent side panel showing: a new app id remounts the screen, an agent rename too when the screen cannot follow it in place.
let agentPanelApp: string | null = null;

export const stashOpenAgentPanel = (appId: string): void => {
  agentPanelApp = appId;
};

// Read without consuming it (safe in a useState initializer, as below).
export const peekOpenAgentPanel = (appId: string): boolean =>
  agentPanelApp === appId;

export const clearOpenAgentPanel = (appId: string): void => {
  if (agentPanelApp === appId) {
    agentPanelApp = null;
  }
};

// Agent renames made in Agent Mode, old id -> new id: its exit is a history.back() onto the old id, which the my-apps route redirects.
const agentRenames = new Map<string, string>();
let leavingAgentMode = false;

export const recordAgentRename = (oldId: string, newId: string): void => {
  agentRenames.forEach((to, from) => {
    if (to === oldId) {
      agentRenames.set(from, newId);
    }
  });
  agentRenames.set(oldId, newId);
};

// Only the exit follows a rename: the next app given the old name gets the same id, and any other navigation to it means that app.
export const markAgentModeExit = (): void => {
  leavingAgentMode = true;
};

export const takeAgentRename = (appId: string): string | undefined => {
  if (!leavingAgentMode) {
    return undefined;
  }
  const renamedTo = agentRenames.get(appId);
  agentRenames.delete(appId);
  return renamedTo;
};

export const clearAgentRenames = (): void => {
  agentRenames.clear();
  leavingAgentMode = false;
};

// The id change an open app screen follows in place: for this one transition the route keeps the screen's key instead of remounting it.
let renamedInPlace: { from: string; to: string } | null = null;

export const markRenamedInPlace = (from: string, to: string): void => {
  renamedInPlace = { from, to };
};

// Read without consuming it: the route asks during render, which StrictMode runs twice.
export const isRenamedInPlace = (from: string, to: string): boolean =>
  renamedInPlace?.from === from && renamedInPlace.to === to;

export const clearRenamedInPlace = (): void => {
  renamedInPlace = null;
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
