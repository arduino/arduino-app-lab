# Example: writing your own EditorPanel extension

This folder is a complete, working content renderer that teaches
EditorPanel to display `.csv` files as a table. It exists as a template:
copy it, rename things, and you have your own extension. The concepts are
documented in [`../../EXTENDING.md`](../../EXTENDING.md); this is the
hands-on version.

It is deliberately **not registered or exported anywhere** — a real
renderer lives with the app that owns the file type, not in the shared
library.

## The three files

| File | Role |
| --- | --- |
| `csvTableContentRenderer.tsx` | the renderer: `id` + `match` + `render` |
| `csv-table.module.scss` | its styles (theme-aware, fills the pane) |
| `csvTableContentRenderer.test.tsx` | the testing template |

## Step by step

1. **Copy this folder** into your app's bucket — for App Lab that is
   `components-by-app/app-lab/editor-panel/`, for an external consumer
   your own codebase. The lint boundary (ADR-0002) will remind you if you
   leave app-specific code in the shared library.

2. **Write `match`.** It receives the `PaneContentContext` (file, paneId,
   readOnly, extras...) and returns whether you handle this pane. Runs on
   every render — keep it cheap, no side effects.

3. **Write `render`.** A pure function of the context returning JSX. No
   hooks at this level; if you need state or effects, return a proper
   component and keep the state inside it. Key your root element by
   `file.id` so content remounts when the user switches files.

4. **Style the container** like the built-ins: `flex: 1; min-height: 0;
   overflow: auto; background: shared.theme-var(--editor-background)` so
   it fills the pane below the tabs bar in both light and dark themes.

5. **Register it** where your app renders EditorPanel:

   ```tsx
   <EditorPanel
     editorPanelLogic={editorPanelLogic}
     getKeywords={getKeywords}
     contentRenderers={[csvTableContentRenderer]}
   />
   ```

   Order matters: your renderers are tried in array order, before the
   shared defaults (images). No match ⇒ the pane falls back to the
   CodeEditor.

6. **Need app state?** Pack it per pane into your logic's
   `paneExtras: { A, B }` and read it back typed from `ctx.extras`. The
   production example is App Lab's brick renderer
   (`appLabContentRenderers.tsx` + `AppLabPaneExtras`).

7. **Test it.** Unit-test `match`/`render` directly against a context
   literal (see the test here); integration-test through the real
   EditorPanel when you need precedence/split behavior (see
   `appLabContentRenderers.test.tsx`).

## What you get for free

Tabs, split view (your renderer just works in pane B — the context is
pane-scoped), cross-pane tab drag-and-drop, resize persistence, and the
read-only flag. What you do **not** control is pane chrome (tabs bar,
toolbars): if you need a chrome contribution point, that is a shared API
change — see ADR-0002.
