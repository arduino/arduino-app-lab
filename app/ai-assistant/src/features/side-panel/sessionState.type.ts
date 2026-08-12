// Visual state of a session row's leading indicator (per Figma "Session Item States").
// Distinct from the coding-agent service's SessionState (turn status) — this is UI-only.
export type SessionState =
  | 'idle'
  | 'typing'
  | 'replyReady'
  | 'active'
  | 'error'
  | 'muted';
