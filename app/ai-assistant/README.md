# @bcmi-labs/app-lab-ai-assistant

Self-contained front-end package for the **Arduino App Lab AI Assistant**.

It owns the AI Assistant UI (panel, model/provider connection, chat — added incrementally),
its React state, and the **service interfaces** the UI depends on. The concrete
implementations are injected by the host app (App Lab desktop) via `setCodingAgentService`
and `setAiRuntimeService`, following the monorepo's dependency-injection pattern.

- Import alias: `@cloud-editor-mono/ai-assistant`
- Entry: `<AiAssistantPanel />`
- Mounted in App Lab via the `AI Models` side-panel item → `/models` route.

See the implementation plan and architecture decisions in the team docs.
