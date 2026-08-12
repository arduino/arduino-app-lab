// Labels for board MCP tools, keyed by the bare tool name (after the `mcp__<server>__` prefix). Designers finalize these.
// Tools not built yet are listed too (expected keys, provisional labels).
const MCP_TOOL_LABELS: Record<string, string> = {
  // --- Live (implemented) ---
  apps_list: 'List apps',
  apps_get: 'Get app details',
  apps_logs: 'Read app logs',
  apps_checkout: 'Check out app files',
  apps_create: 'Create app',
  apps_start: 'Start app',
  apps_stop: 'Stop app',
  apps_delete: 'Delete app',
  apps_edit: 'Edit app details',
  apps_clone: 'Clone app',
  sketch_libraries_list: 'List sketch libraries',
  sketch_libraries_add: 'Add sketch library',
  sketch_libraries_remove: 'Remove sketch library',
  app_bricks_list: "List the app's bricks",
  app_bricks_add: 'Add brick to app',
  app_bricks_update: 'Update app brick',
  app_bricks_remove: 'Remove brick from app',
  bricks_list: 'List available bricks',
  bricks_get: 'Get brick details',
  board_status: 'Board status',
  boards_list: 'List boards',
  wifi_status: 'Wi-Fi status',
  system_resources: 'System resources',
  system_name: 'Board name',
  models_list: 'List AI models',
  models_delete: 'Delete AI model',
  board_exec: 'Run a command on the board',
  // --- Planned (not built yet) — expected keys, provisional labels for design ---
  wifi_connect: 'Connect to Wi-Fi',
};

// The local mirror stores each app under `<checkout-key>/…` (the agent's cwd is the mirror root), so a
// native file tool's path carries an opaque key prefix. Return the path without it — handles absolute
// (`…/ai-mirror/<key>/…`) and relative (`<key>/…`) forms; leaves ordinary paths (e.g. `src/index.ts`) alone.
// Exported for callers holding a whole path: formatToolTitle only sees whitespace-delimited tokens.
const MIRROR_MARKER = '/ai-mirror/';
export const stripKeyFromPath = (path: string): string => {
  const marker = path.indexOf(MIRROR_MARKER);
  if (marker >= 0) {
    const after = path.slice(marker + MIRROR_MARKER.length); // <key>/rest
    const slash = after.indexOf('/');
    return slash >= 0 ? after.slice(slash + 1) : after;
  }
  // Relative `<key>/rest`: strip the first segment only when it looks like a checkout key (>=12 chars,
  // no dot), so real relative dirs like `src/index.ts` are left untouched.
  const slash = path.indexOf('/');
  if (
    slash >= 12 &&
    !path.startsWith('/') &&
    !path.slice(0, slash).includes('.')
  ) {
    return path.slice(slash + 1);
  }
  return path;
};

// Turn an MCP tool's wire name (mcp__<server>__<tool>) into a readable label; native tool titles keep
// their text but get the opaque local-mirror key stripped from any path token (so the permission popup
// and timeline show `assets/style.css`, not `<checkout-key>/assets/style.css`).
export const formatToolTitle = (title: string): string => {
  if (!title.startsWith('mcp__')) {
    return title.replace(/\S+/g, (tok) =>
      tok.includes('/') ? stripKeyFromPath(tok) : tok,
    );
  }
  const tool = title.split('__').slice(2).join('__');
  if (!tool) {
    return title;
  }
  const mapped = MCP_TOOL_LABELS[tool];
  if (mapped) {
    return mapped;
  }
  // Fallback for any unmapped tool: "app_bricks_add" -> "App bricks add".
  const spaced = tool.replace(/[_.]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Web tools read as an action, not a raw title or shell command: "Search the web: <query>" / "Fetch page: <url>". Returns null for any other tool.
export const webToolLabel = (
  kind: string | undefined,
  input: unknown,
): string | null => {
  // Web tools are ACP kind 'fetch' (network): WebSearch carries a `query`, WebFetch a `url`. File search (Grep/Glob) is kind 'search' — local, not web — so it keeps its normal title.
  if (kind !== 'fetch') {
    return null;
  }
  const o =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {};
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const query = str(o.query);
  if (query) {
    return `Search the web: ${query}`;
  }
  const url = str(o.url);
  if (url) {
    return `Fetch page: ${url}`;
  }
  return null;
};
