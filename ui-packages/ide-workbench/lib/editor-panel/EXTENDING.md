# Extending EditorPanel

EditorPanel works like a small extension host: it owns the editor *shell*
(tabs, split view, drag-and-drop, resize persistence, CodeMirror linking)
and delegates the *content* of each pane to registered *content
renderers* — the same idea as VS Code custom editors, where an extension
declares which files it handles and the workbench keeps owning tabs and
layout. Apps add file-type support by registering a renderer; nobody adds
file-type branches inside EditorPanel itself (enforced by lint, see
"Boundaries" below).

## The contribution point

```tsx
import { PaneContentRenderer } from '@cloud-editor-mono/ide-workbench';

const csvRenderer: PaneContentRenderer = {
  id: 'my-app-csv',
  match: ({ file }) => file.ext === 'csv',
  render: ({ file }) => <CsvTable data={file.getData()} />,
};

<EditorPanel
  editorPanelLogic={editorPanelLogic}
  getKeywords={getKeywords}
  contentRenderers={[csvRenderer]}
/>
```

There is a second contribution point with the same contract:
**`workspaceRenderers`**. A match there replaces the *whole* editor
workspace (split layout and per-pane tabs bars; only the top-level tabs
bar stays) instead of one pane's content — use it for views that take
over the editor surface. The production example is the sketch-secrets
editor (`secretsWorkspaceRenderer` in `lib/secrets-editor/`), registered
by both apps.

Resolution rules:

1. Renderers are tried **in array order**; the first whose `match(ctx)`
   returns true fills the pane.
2. App-provided renderers are tried **before** the built-in defaults
   (currently: images). So an app can override a default by matching the
   same files.
3. When nothing matches, the pane falls back to the **CodeEditor**. This
   also drives split-view linking: two panes showing the same file only
   live-sync when both fall through to the CodeEditor.
4. Renderers run once per pane. The same renderer instance serves pane A
   and pane B; everything pane-specific arrives in the context.

## The context (`PaneContentContext`)

| Field | What it is |
| --- | --- |
| `file` | `{ id, ext, getData() }` of the file shown in this pane |
| `paneId` | `'A'` (left) or `'B'` (right/split) |
| `readOnly` | whether the editor is read-only |
| `shouldRenderMarkdown` | pane-scoped preview toggle state |
| `openExternalLink`, `onCopyCode` | host callbacks for content to reuse |
| `extras` | opaque app-owned per-pane state — see below |
| `classes` | style hooks (`editorImage`) |

`render` must be a pure function of this context: no hooks, no reaching
into stores. If your content needs app state, that state must travel
through `extras`.

## App state: the `extras` channel

The shared panel never inspects app state; it forwards it. The app packs
per-pane state into its `EditorPanelLogic` result:

```ts
paneExtras: {
  A: { brickDetailLogic, brickSelectedTab, setBrickSelectedTab },
  B: { brickDetailLogic, brickSelectedTab: rightPaneTab, ... },
}
```

and reads it back — typed — inside its own renderers via `ctx.extras`.
The type stays app-owned on both ends (see `AppLabPaneExtras` in
`components-by-app/app-lab/editor-panel/appLabContentRenderers.tsx` for
the reference implementation).

## Start here: the copyable example

[`examples/csv-table/`](examples/csv-table/README.md) is a complete
extension (renderer + styles + tests + step-by-step README) that shows a
`.csv` file rendered as a table. Copy that folder into your app's bucket
and rename — it is the fastest path to a working extension.

## Worked example: App Lab

App Lab contributes brick detail and markdown preview:

- renderers: `components-by-app/app-lab/editor-panel/appLabContentRenderers.tsx`
- registration: `AppLabEditorPanel.tsx` (`contentRenderers={appLabContentRenderers}`)
- state packing: `app/core-ui/src/app-lab/.../appLabEditorPanel.ts` (`paneExtras`)
- tests: `appLabContentRenderers.test.tsx` — copy this pattern to test a
  new renderer through the real EditorPanel.

Cloud Editor registers no pane content renderers (it gets the shared
defaults) and one workspace renderer: `secretsWorkspaceRenderer`,
registered in `app/core-ui/src/sections/EditSection.tsx` with
`secretsEditorLogic` packed into `paneExtras.A` by `main.logic.tsx`
(`SecretsPaneExtras` contract).

## Boundaries

An ESLint rule (root `.eslintrc.js`, per ADR-0002) blocks any import from
`components-by-app/app-lab` in shared library code. If your renderer only
makes sense for one app, it lives in that app's bucket and reaches the
panel through `contentRenderers` — never through an import inside
`ide-workbench/`.

## Host capabilities (clipboard, external links)

Some things the editor needs are neither state nor content: they are
capabilities whose implementation belongs to the host. They arrive on
`CodeEditorLogic`, not through an import.

```ts
codeEditorLogic = () => ({
  // ...state
  clipboard: {
    readText: () => readText(),
    writeText: (text) => writeText(text),
    // Set when a system-clipboard read can prompt the user or come back
    // empty: the editor then mirrors copies/cuts in memory and pastes
    // from the mirror, refreshing it when the menu opens.
    preferInMemoryPaste: true,
  },
  // Where the LSP hover links go. Omit it and they stay inert.
  openExternalLink: openLinkExternal,
});
```

Omit `clipboard` and the editor uses `browserClipboard`
(`navigator.clipboard`), which is the right answer for a plain web host.
App Lab injects the desktop shell's bridge (see
`app/core-ui/src/app-lab/features/app/app-detail/sub-components/editor-panel/appLabEditorPanel.ts`).

Do not reach for these directly from inside the package: an ESLint rule
bans `app/domain` in `ide-workbench/lib`, and a `Config.APP_NAME` branch is
worse than an import — a host outside this repo has no entry in that enum.

## Host components (how the controls look)

The editor's own controls use the package's internal copy of the leaf UI.
An app that wants them to match its own UI injects components through the
`components` prop; anything it leaves out keeps the package's copy.

```tsx
const myEditorComponents: Partial<EditorComponents> = {
  IconButton: ({ label, Icon, onPress, isDisabled, isPressed }) => (
    <MyIconButton
      label={label}
      icon={Icon}
      disabled={isDisabled}
      aria-pressed={isPressed}
      // The contract's onPress takes no arguments: do not pass the event on.
      onClick={onPress && ((): void => onPress())}
    />
  ),
};

<EditorPanel components={myEditorComponents} ... />;
```

- Define the object at module level. A new object on every render
  re-renders every control that reads it.
- Today the contract has one entry, `IconButton`, used by the tabs bar's
  split and agent toggles. App Lab's adapter is
  `components-by-app/app-lab/editor-panel/appLabEditorComponents.tsx`.
- Each entry is public API once the package is published. Add one when an
  app needs it, in `lib/editor-components/editorComponents.type.ts`, and
  keep its props to what the editor passes. Controls inside CodeMirror
  panels (find-and-replace, LSP references) render in a separate React
  root, so an entry used there also needs the context passed to that root.

## What renderers do NOT control

Pane chrome stays with EditorPanel: the tabs bar, the split CTA, the
markdown write/preview toolbar, drag-and-drop, and the editor controls.
An app can change how some of those controls look (`components`, above),
not what they do.
If you need a new chrome contribution point (e.g. per-file-type toolbar
actions), that is an EditorPanel API change — reference ADR-0002 in the
PR and extend the contract there, don't special-case a file type in the
shared component.
