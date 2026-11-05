import { describe, expect, it } from 'vitest';

import {
  isAuthError,
  isBareInternalError,
  isNetworkError,
  parseAgentError,
} from './agentErrors';

// A turn that dies in transport reads nothing like one the provider rejected, and the user can act on
// it (reconnect) — so the classification decides whether the banner blames the connection.
describe('isNetworkError', () => {
  it.each([
    'fetch failed',
    'TypeError: Failed to fetch',
    'API Error: Connection error.',
    'connect ECONNREFUSED 127.0.0.1:443',
    'getaddrinfo ENOTFOUND api.anthropic.com',
    'getaddrinfo EAI_AGAIN api.anthropic.com',
    'read ECONNRESET',
    'socket hang up',
    'connect ETIMEDOUT',
    'connect ENETUNREACH',
    'net::ERR_INTERNET_DISCONNECTED',
  ])('reports a transport failure: %s', (message) => {
    expect(isNetworkError(message)).toBe(true);
  });

  it.each([
    'Invalid API key · Please run /login',
    'rate limit exceeded, retry after 60s',
    'The session was not found',
    'Internal error: tool "board_exec" is not allowed',
    '',
  ])('leaves the agent to explain its own failure: %s', (message) => {
    expect(isNetworkError(message)).toBe(false);
  });
});

// A refused credential sends Claude back to sign in, so a number that only contains 401 must not count.
describe('isAuthError', () => {
  it.each([
    '401 Unauthorized: invalid x-api-key',
    'Request failed with status code 401',
    'authentication_error: invalid token',
    'Unauthorized',
  ])('reports a refused credential: %s', (message) => {
    expect(isAuthError(message)).toBe(true);
  });

  it.each([
    'listen tcp :4010: bind: address already in use',
    'Unexpected token at position 4012',
    'quota exceeded for model X',
  ])('leaves any other failure alone: %s', (message) => {
    expect(isAuthError(message)).toBe(false);
  });

  it('reports the ACP auth-required code whatever the text', () => {
    expect(isAuthError('', -32000)).toBe(true);
  });
});

// What the Go host returns: the ACP SDK's JSON-RPC error, printed as JSON with its data.
describe('parseAgentError', () => {
  it('takes the cause of a bare internal error from data.details', () => {
    const raw =
      '{"code":-32603,"message":"Internal error","data":{"details":"Tool permission request failed: socket closed"}}';

    expect(parseAgentError(raw)).toEqual({
      message: 'Internal error',
      cause: 'Tool permission request failed: socket closed',
      code: -32603,
    });
  });

  it.each([
    [
      'data itself, when the details were JSON',
      '{"message":"ENOENT: no such file"}',
      'ENOENT: no such file',
    ],
    [
      "data.error, for the Go SDK's own failures",
      '{"error":"peer disconnected before response"}',
      'peer disconnected before response',
    ],
  ])('takes the cause from %s', (_where, data, cause) => {
    const raw = `{"code":-32603,"message":"Internal error","data":${data}}`;

    expect(parseAgentError(raw).cause).toBe(cause);
  });

  it('keeps a message that already names the cause', () => {
    const raw =
      '{"code":-32603,"message":"Internal error: The Claude Agent process exited unexpectedly.","data":{"details":"exit 1"}}';

    expect(parseAgentError(raw)).toEqual({
      message: 'The Claude Agent process exited unexpectedly.',
      code: -32603,
    });
  });

  // If the classifiers read the cause, "position 401" would look like an expired login.
  it('leaves the cause out of the message the classifiers read', () => {
    const { message, code } = parseAgentError(
      '{"code":-32603,"message":"Internal error","data":{"details":"Unexpected token at position 401, connection closed"}}',
    );

    expect(isAuthError(message, code)).toBe(false);
    expect(isNetworkError(message)).toBe(false);
  });

  // The host loads a chat before its prompt; the kind of a failed load says whether a retry can help.
  it.each([
    [
      'session_gone',
      -32002,
      'The agent no longer has this chat, so it cannot reopen it. Start a new chat.',
    ],
    [
      'session_load_failed',
      -32603,
      'The agent could not reopen this chat. Try again.',
    ],
  ])('reads the %s kind of a failed load', (kind, code, message) => {
    const parsed = parseAgentError(
      JSON.stringify({ code, message, data: { errorKind: kind } }),
    );

    expect(parsed).toEqual({ message, kind, code });
    expect(isAuthError(parsed.message, parsed.code)).toBe(false);
    expect(isNetworkError(parsed.message)).toBe(false);
  });

  it('leaves a bare internal error for the view to explain', () => {
    const { message, cause } = parseAgentError(
      '{"code":-32603,"message":"Internal error","data":{}}',
    );

    expect(message).toBe('Internal error');
    expect(cause).toBeUndefined();
    expect(isBareInternalError(message)).toBe(true);
    expect(isBareInternalError('Tool permission request failed')).toBe(false);
  });
});
