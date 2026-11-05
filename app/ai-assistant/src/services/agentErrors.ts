// Parsing the agent's JSON-RPC prompt errors (message/cause/kind/code) and spotting the two failures the UI
// answers differently: auth (re-authenticate) and network (reconnect and retry).

// The request never reached the provider (no route, DNS down, connection dropped mid-flight) rather
// than being rejected by it — the failure is the network's, so the copy points at the connection.
const NETWORK_ERROR =
  /fetch failed|failed to fetch|network ?error|connection (error|refused|reset|closed)|socket hang up|getaddrinfo|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|ENETDOWN|ERR_INTERNET_DISCONNECTED/i;

export const isNetworkError = (message: string): boolean =>
  NETWORK_ERROR.test(message);

// The turn failed auth (expired/revoked token, bad key): ACP authRequired (-32000) or an auth message; a port like ":4010" is no 401.
export const isAuthError = (message: string, code?: number): boolean =>
  code === -32000 || /\b401\b|authenticat|unauthorized/i.test(message);

const BARE_INTERNAL_ERROR = /^\s*internal error\.?\s*$/i;

// A failure that names no cause: the view has to explain it in its own words.
export const isBareInternalError = (message?: string): boolean =>
  !message?.trim() || BARE_INTERNAL_ERROR.test(message);

// Where a bare "Internal error" carries its cause: data.details or data.message (ACP TS SDK), data.error (ACP Go SDK).
const causeIn = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { details, message, error } = data as Record<string, unknown>;
  return [details, message, error]
    .find((c): c is string => typeof c === 'string' && c.trim() !== '')
    ?.trim();
};

type AgentError = {
  message: string;
  cause?: string; // free text, set only when message is bare: show it, never feed it to isAuthError or isNetworkError
  kind?: string;
  code?: number;
};

// The prompt rejects with the agent's JSON-RPC error — as a string, an Error wrapping it, or the parsed object. Pull out its message, cause, kind and code.
export const parseAgentError = (e: unknown): AgentError => {
  const pick = (o: unknown): AgentError | null => {
    if (!o || typeof o !== 'object') {
      return null;
    }
    const r = o as {
      message?: unknown;
      code?: unknown;
      data?: { errorKind?: unknown };
    };
    if (typeof r.message !== 'string') {
      return null;
    }
    const message = r.message.replace(/^Internal error:\s*/i, '');
    return {
      message,
      cause: isBareInternalError(message) ? causeIn(r.data) : undefined,
      kind:
        typeof r.data?.errorKind === 'string' ? r.data.errorKind : undefined,
      code: typeof r.code === 'number' ? r.code : undefined,
    };
  };
  if (typeof e === 'object' && e !== null && !(e instanceof Error)) {
    const direct = pick(e);
    if (direct) {
      return direct;
    }
  }
  const raw =
    e instanceof Error ? e.message : typeof e === 'string' ? e : String(e);
  try {
    const parsed = pick(JSON.parse(raw));
    if (parsed) {
      return parsed;
    }
  } catch {
    // not a JSON-RPC payload — fall back to the raw text
  }
  return { message: raw };
};
