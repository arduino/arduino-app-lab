/**
 * Opens a URL in the system browser when running inside the Wails desktop host,
 * which injects `window.runtime`. Wails navigates same-window external links in
 * the webview and blocks `target="_blank"` new windows, so neither plain nor
 * `_blank` anchors reach the browser — we hand the URL to the runtime instead.
 * Returns false when no host runtime is present (e.g. dev in a plain browser),
 * so the caller can fall back to the anchor's default behavior.
 */
export const openInSystemBrowser = (url: string): boolean => {
  const open = (
    window as unknown as { runtime?: { BrowserOpenURL?: (u: string) => void } }
  ).runtime?.BrowserOpenURL;
  open?.(url);
  return Boolean(open);
};
