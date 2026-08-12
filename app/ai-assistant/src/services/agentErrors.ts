// Parsing the agent's JSON-RPC prompt errors (message/kind/code) and spotting auth failures.

// The turn failed auth (expired/revoked token, bad key): ACP authRequired (-32000) or a 401/auth message.
export const isAuthError = (message: string, code?: number): boolean =>
  code === -32000 || /401|authenticat|unauthorized/i.test(message);

// The prompt rejects with the agent's JSON-RPC error — as a string, an Error wrapping it, or the parsed object. Pull out a readable message, its kind, and its code.
export const parseAgentError = (
  e: unknown,
): { message: string; kind?: string; code?: number } => {
  const pick = (
    o: unknown,
  ): { message: string; kind?: string; code?: number } | null => {
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
    return {
      message: r.message.replace(/^Internal error:\s*/i, ''),
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
