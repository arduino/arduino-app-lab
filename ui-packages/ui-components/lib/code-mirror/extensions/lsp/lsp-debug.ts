import { Config } from '@cloud-editor-mono/common';

/**
 * Frontend switch for LSP debug logging.
 *
 * Two things are invisible in a production build when diagnosing an LSP issue
 * in the field (e.g. the Windows "undeclared identifier" reports):
 *  - the frontend gates its own LSP client/server message logging off in prod;
 *  - the desktop backend sends its slog output (clangd / language-server
 *    stderr, crash/restart events) to log files the user can't easily reach.
 *
 * This module is the single runtime switch that turns both back on so the logs
 * show up in the dev-tools console. Non-production builds are always on.
 *
 * Enable in a production build from the dev-tools console with
 * `arduinoLspDebug(true)` (exposed by useLSP), or persist it by hand with
 * `localStorage['lsp-debug'] = '1'`.
 */

// localStorage key; may also be set by hand from the dev-tools console.
export const LSP_DEBUG_STORAGE_KEY = 'lsp-debug';

// Wails event names bridging backend LSP logs to the frontend console.
// Keep in sync with the Go side (standalone-apps/app-lab-desktop/internal/lsp/lsp.go).
export const LSP_LOG_EVENT = 'lsp-log';
export const LSP_SET_DEBUG_LOGGING_EVENT = 'lsp-set-debug-logging';

/**
 * Terminal LSP failure. Unlike LSP_LOG_EVENT this is never gated on the debug
 * flag — it is a state transition, and the editor has to stop showing the
 * language server as loading whether or not anyone is watching the console.
 */
export const LSP_FAILED_EVENT = 'lsp-failed';

/** One backend LSP log line forwarded to the console (mirrors Go `lspLogLine`). */
export interface LspLogLine {
  level: 'info' | 'warn' | 'error';
  source: string;
  processId: string;
  msg: string;
}

/** A language server that is not coming back (mirrors Go `lspFailure`). */
export interface LspFailure {
  lspId: string;
  reason: string;
}

const readStoredFlag = (): boolean => {
  try {
    return localStorage.getItem(LSP_DEBUG_STORAGE_KEY) === '1';
  } catch {
    // localStorage can throw (privacy mode / disabled storage): treat as off.
    return false;
  }
};

// Cached so isLspDebugEnabled() stays O(1): lspLog calls it on every LSP
// message. Seeded from storage at load; setLspDebug keeps it in sync. Editing
// localStorage by hand needs a reload to take effect (or call setLspDebug).
let debugEnabled = readStoredFlag();

/** True when LSP logs should be printed to the console. */
export const isLspDebugEnabled = (): boolean =>
  Config.MODE !== 'production' || debugEnabled;

/** Toggle debug logging now and persist it across reloads. */
export const setLspDebug = (enabled: boolean): void => {
  debugEnabled = enabled;
  try {
    if (enabled) {
      localStorage.setItem(LSP_DEBUG_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(LSP_DEBUG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures; the in-memory toggle still applies this session.
  }
};
