# services — backend boundary

Everything in this folder is the **BE-facing layer** of the AI Assistant FE: the
service contracts the UI depends on — `coding-agent-service` (`CodingAgentService`)
and `ai-runtime-service` (`AiRuntimeService`) — and their dependency-injection
slots (`setCodingAgentService` / `setAiRuntimeService`). The concrete,
Wails-backed implementations live in the desktop app and are injected at
startup. The Go runtime manager behind `ai-runtime-service` is a different
layer, owned separately.

Authentication follows the ACP model (like Zed): App Lab never stores provider
keys — `authenticate` delegates to the agent CLI's own login flow.

It is intentionally self-contained (no imports from `../features` or `../store`)
so it can be moved or extracted into its own package later.
