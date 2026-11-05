# ADR-0001 — Logic injection for shared UI components

## Status

Accepted (retroactive — documents a convention in place since the early
days of the monorepo; see also the root `README.md`, §Architecture).

## Context

The monorepo serves two apps (Cloud Editor and App Lab) from one shared
component library (`ui-packages/ui-components`). Components need
app-specific state and behavior without depending on any app's stores,
routing, or API clients — otherwise the library cannot be reused, tested in
isolation, or (eventually) published.

## Decision

Shared components receive their non-UI logic as an injected factory prop,
by convention named `<component>Logic` and typed `<Component>Logic`:

```tsx
type EditorPanelLogic = () => { /* state + callbacks */ };

<EditorPanel editorPanelLogic={editorPanelLogic} />
```

The factory is a hook: it is called inside the component, once per render,
and may itself use hooks. Each app implements the factory in its own logic
layer (`app/core-ui/src/<app>/features/...`), wiring the app's stores and
services behind the contract.

Complementary conventions:

- **`classes` prop** — apps inject styling through a map of class names,
  never by reaching into the component's internals.
- **JSX slots** — self-contained visual fragments are passed as
  `JSX.Element` props (e.g. `readOnlyBanner`).

## Consequences

- Shared components stay free of app imports and are testable with a stub
  factory.
- The `*Logic` type is the public contract; changing it is a structural
  change and should be reviewed as such.
- The contract must only contain fields meaningful to *every* consumer;
  app-specific concepts belong in the app's own wrapper (see ADR-0002 for
  a violation of this rule and its fix).
