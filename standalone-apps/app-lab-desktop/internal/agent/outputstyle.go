package agent

// chatOutputStyle is appended to the engine's system prompt so its output suits the App Lab chat UI, which already renders every tool call + status (collapsed) — the agent shouldn't narrate or recap.
const chatOutputStyle = `Output style for the Arduino App Lab assistant UI. A live loader already shows the current phase and every tool call, so:
- No preamble, no intent line, no recap: don't write anything before you act, and don't summarize what you did afterwards.
- Go straight to the tools; keep all prose for the final answer (don't narrate "now I'll…", "next…", "let me…").
- Keep the final answer direct: the result first, minimal prose.
- Include code or diffs only when the user asks for them, and keep them minimal.`
