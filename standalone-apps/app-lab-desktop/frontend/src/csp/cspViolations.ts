/**
 * Report Content-Security-Policy refusals, which the app otherwise cannot tell
 * apart from an unreachable board.
 *
 * Release builds serve a policy from the asset server (see
 * `internal/app/csp_policy.go`). A request it refuses fails as a *network*
 * error, by design - the Fetch spec will not say why, so `fetch` rejects with a
 * bare `TypeError`, `EventSource` fires an `onerror` carrying no reason, and a
 * `WebSocket` errors and closes. None of that is distinguishable from a board
 * that is not answering, which is the failure everyone here assumes first.
 *
 * It is worse than merely confusing: `checkBoardUpdate`, `getBoardUpdateLogs`
 * and `applyBoardUpdate` all catch `TypeError` and quietly reroute through Go,
 * logging at `console.debug`. A policy missing an origin therefore does not
 * present as a broken app - it presents as a working one that is slower for
 * reasons nobody can see.
 *
 * This event is the one place the real reason survives, so it is logged loudly.
 * The listener lives for the life of the app; the returned remover exists for
 * tests.
 *
 * It is not available everywhere, which matters because this app runs on three
 * engines: the Document event is Chrome 76+ (so any WebView2) but WebKit 15.4+,
 * and on Linux the WebKitGTK version is the distro's or the board image's
 * choice. Where it is missing, violations reach the webview console and nothing
 * else - so that is reported too, because a listener that never fires is
 * indistinguishable from a policy that never blocks anything.
 */
export function registerCspViolationLogging(): () => void {
  // A proxy for the event, not the event itself: WebKit gained the handler
  // attribute shortly before it fired the Document event. Close enough to tell
  // an engine that has neither from one that has both.
  if (!('onsecuritypolicyviolation' in document)) {
    console.warn(
      '[csp] this webview does not report policy violations to the page. ' +
        'A refused request will surface only as a generic network failure - ' +
        'check the webview console for the violation itself.',
    );
    return () => undefined;
  }

  const onViolation = (event: SecurityPolicyViolationEvent): void => {
    // `effectiveDirective` is the current name, `violatedDirective` the legacy
    // one some engines still report instead.
    const directive = event.effectiveDirective || event.violatedDirective;
    const source = event.sourceFile
      ? ` (from ${event.sourceFile}:${event.lineNumber})`
      : '';

    console.error(
      `[csp] ${directive} refused ${event.blockedURI}${source}. ` +
        'This is the policy blocking the request, not an unreachable host - ' +
        'add the origin in internal/app/csp_policy.go if it belongs there.',
      { disposition: event.disposition, policy: event.originalPolicy },
    );
  };

  document.addEventListener('securitypolicyviolation', onViolation);

  return () =>
    document.removeEventListener('securitypolicyviolation', onViolation);
}
