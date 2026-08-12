import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerCspViolationLogging } from './cspViolations';

// jsdom does not implement SecurityPolicyViolationEvent, and the listener only
// reads properties off the event, so a plain Event carrying them is enough.
const dispatchViolation = (
  fields: Partial<SecurityPolicyViolationEvent>,
): void => {
  document.dispatchEvent(
    Object.assign(new Event('securitypolicyviolation'), fields),
  );
};

describe('csp violation logging', () => {
  const error = vi.fn();
  let unregister: () => void;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(error);
    unregister = registerCspViolationLogging();
  });

  afterEach(() => {
    unregister();
    error.mockReset();
    vi.restoreAllMocks();
  });

  it('reports the directive and the refused url', () => {
    dispatchViolation({
      effectiveDirective: 'connect-src',
      blockedURI: 'http://127.0.0.1:53421',
    });

    expect(error).toHaveBeenCalledTimes(1);
    const [message] = error.mock.calls[0];
    expect(message).toContain('connect-src');
    expect(message).toContain('http://127.0.0.1:53421');
  });

  // The point of logging at all: the request failed for a reason no catch block
  // downstream can recover, so say so where someone will read it.
  it('says the policy is the cause, not an unreachable host', () => {
    dispatchViolation({
      effectiveDirective: 'connect-src',
      blockedURI: 'http://127.0.0.1:53421',
    });

    expect(error.mock.calls[0][0]).toContain('not an unreachable host');
  });

  it('includes the source location when the event carries one', () => {
    dispatchViolation({
      effectiveDirective: 'connect-src',
      blockedURI: 'http://127.0.0.1:53421',
      sourceFile: 'wails://wails/assets/index.js',
      lineNumber: 42,
    });

    expect(error.mock.calls[0][0]).toContain(
      'wails://wails/assets/index.js:42',
    );
  });

  it('omits the source location when the event has none', () => {
    dispatchViolation({
      effectiveDirective: 'connect-src',
      blockedURI: 'http://127.0.0.1:53421',
    });

    expect(error.mock.calls[0][0]).not.toContain('from ');
  });

  // Some engines report the legacy field name instead.
  it('falls back to violatedDirective', () => {
    dispatchViolation({
      effectiveDirective: '',
      violatedDirective: 'frame-src',
      blockedURI: 'https://example.invalid/embed',
    });

    expect(error.mock.calls[0][0]).toContain('frame-src');
  });

  it('stops reporting once unregistered', () => {
    unregister();

    dispatchViolation({
      effectiveDirective: 'connect-src',
      blockedURI: 'http://127.0.0.1:53421',
    });

    expect(error).not.toHaveBeenCalled();
  });
});

// The three webviews this app ships on do not all fire this event: it is
// Chrome 76+ but WebKit 15.4+, and on Linux the WebKitGTK version belongs to the
// distro or the board image. An engine that cannot report has to say so, or a
// listener that never fires reads as a policy that never blocks.
describe('csp violation logging on a webview without support', () => {
  const warn = vi.fn();
  let supported: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(warn);

    supported = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'onsecuritypolicyviolation',
    );
    // jsdom has the handler attribute; take it away to stand in for an engine
    // that does not.
    delete (Document.prototype as unknown as Record<string, unknown>)
      .onsecuritypolicyviolation;
  });

  afterEach(() => {
    if (supported) {
      Object.defineProperty(
        Document.prototype,
        'onsecuritypolicyviolation',
        supported,
      );
    }
    warn.mockReset();
    vi.restoreAllMocks();
  });

  it('warns that violations will not reach the page', () => {
    const unregister = registerCspViolationLogging();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'does not report policy violations to the page',
    );

    // and still hands back a remover, so callers need no special case
    expect(() => unregister()).not.toThrow();
  });
});
