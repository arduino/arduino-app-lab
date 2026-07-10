# File icons

The file icons rendered by `<FileIcon />` come from two sources:

| Source | What | Where |
| --- | --- | --- |
| **App Lab** (this repo) | Resolver, filename/extension mapping, our `.ino` / `.brick` icons | `FileIcon.tsx`, `manifest.ts`, `../icons/` |
| **[Seti UI](https://github.com/jesseweed/seti-ui)** (MIT, Jesse Weed) | Generic file/language SVGs and per-icon colors | [`./seti/`](./seti/) |

Everything under [`./seti/`](./seti/) is vendored from upstream and kept in
sync by a script — don't edit by hand. The upstream license lives at
[`./seti/LICENSE`](./seti/LICENSE).

## Layout

```
file-icons/
├── FileIcon.tsx      App Lab — resolver component
├── manifest.ts       App Lab — filename/extension → icon-key map
├── index.ts          App Lab — public exports
└── seti/             vendored (MIT)
    ├── LICENSE
    ├── VERSION       pinned upstream commit SHA
    ├── colors.json   per-icon fill colors
    ├── index.ts      ?react barrel (auto-generated)
    └── svg/          raw upstream SVGs
```

`colors.json` carries a `$description` field that documents how the data is
derived; the script only rewrites the `colors` object.

The `LICENSE` and `VERSION` files are consumed by
`dev-utils/al-license/licensed.sh`, which appends a seti-ui block to the
generated NOTICE so the Debian copyright bundle attributes the upstream
snapshot.

## Updating

```sh
# Pin to upstream master HEAD
yarn sync-seti-icons

# Or pin to a specific seti-ui commit
yarn sync-seti-icons <sha>
```

The script:

- fetches only the SVGs referenced by `manifest.ts` from the pinned seti-ui
  commit,
- prunes any orphan SVGs no longer in the manifest,
- rewrites the `colors` field of `seti/colors.json` (the description is
  preserved),
- regenerates `seti/index.ts`,
- writes the pinned commit SHA to `seti/VERSION` (consumed by
  `dev-utils/al-license/licensed.sh` when generating the NOTICE).

After running it, regenerate the license bundle so the NOTICE / Debian
copyright reflects the new SHA:

```sh
yarn workspace @bcmi-labs/al-license licensed
```
