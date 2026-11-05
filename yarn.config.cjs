// Checked by `yarn constraints`. The strategy is described in README.md,
// "Where dependency versions live".
const fs = require('fs');
const path = require('path');
const semver = require('semver');

const COMPONENT = 'consumable-app-components/cloud-editor-component';
// The host provides one instance of these: two copies of React, or of a package
// whose React context the component shares with the host, break hooks and
// context. Every other package the component imports goes in `dependencies`,
// except CodeMirror, which the component bundles (see DEPENDENCIES.md).
const COMPONENT_PEERS = new Set([
  'react',
  'react-dom',
  '@bcmi-labs/art-auth',
  '@bcmi-labs/art-ui',
  '@bcmi-labs/cloud-sidebar',
]);
// Component ranges are carets so a host can take minor and patch releases on
// its own. An exact pin goes here with the reason, e.g. an upstream release
// that breaks the API.
const COMPONENT_PINS = {};
const COMPONENT_FIELDS = ['peerDependencies', 'dependencies'];
// The editor package will be published so that App Lab and Cloud Editor can
// install it from separate repositories (docs/adr/0002, phase 4b). Its
// peerDependencies are the list a consumer must install; it declares nothing
// else, and the root still owns every installed version.
const WORKBENCH = 'ui-packages/ide-workbench';
const ROOT_BIN = path.join(__dirname, 'node_modules', '.bin');

// `resolution` is null for some root dependencies, so fall back to what is
// installed. Without a version the peer check would pass silently.
function installedVersion(dep) {
  if (dep.resolution?.version) return dep.resolution.version;
  try {
    const manifest = path.join(
      __dirname,
      'node_modules',
      dep.ident,
      'package.json',
    );
    return JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
  } catch {
    return null;
  }
}

// A workspace script only sees the binaries of that workspace's own
// dependencies, and workspaces declare none. `yarn run -T` runs the root's.
// Callers such as `wails build` or CI `working-directory` steps do not have
// the root `.bin` on PATH, so a bare binary name fails there.
function bareRootBinaries(script, rootBinaries) {
  return script
    .split(/&&|\|\||;|\|/)
    .map((command) => command.trim().replace(/^([A-Z_][A-Z0-9_]*=\S*\s+)*/, ''))
    .map((command) => command.split(/\s+/)[0])
    .map((word) => word.replace(/^(\.\.\/)+node_modules\/\.bin\//, ''))
    .filter((word) => rootBinaries.has(word));
}

module.exports = {
  async constraints({ Yarn }) {
    const root = Yarn.workspace({ cwd: '.' });

    for (const dep of Yarn.dependencies()) {
      const cwd = dep.workspace.cwd;
      if (cwd === '.') continue;
      if (cwd === COMPONENT) continue;
      if (cwd === WORKBENCH && dep.type === 'peerDependencies') continue;
      dep.error(
        `declare ${dep.ident} in the root package.json; workspace packages declare no dependencies`,
      );
    }

    for (const dep of Yarn.dependencies({
      workspace: root,
      type: 'devDependencies',
    })) {
      if (
        Yarn.dependency({
          workspace: root,
          ident: dep.ident,
          type: 'dependencies',
        })
      ) {
        dep.error(
          `${dep.ident} is in both root dependencies and devDependencies`,
        );
      }
    }

    const component = Yarn.workspace({ cwd: COMPONENT });
    // The open-source repo has no component.
    if (component) {
      // Yarn reports a non-semver range such as `npm:clsx@^2` as `*`, in the
      // dependency and in `component.manifest`, so read the file itself.
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, COMPONENT, 'package.json'),
          'utf8',
        ),
      );
      for (const peer of COMPONENT_PEERS) {
        if (!manifest.peerDependencies?.[peer]) {
          component.error(`declare ${peer} in the component peerDependencies`);
        }
      }
      for (const dep of Yarn.dependencies({ workspace: component })) {
        const range = manifest[dep.type]?.[dep.ident];
        if (dep.ident.startsWith('@cloud-editor-mono/')) {
          dep.error(
            `${dep.ident} is internal: the component bundles it, so it is not listed`,
          );
          continue;
        }
        if (!COMPONENT_FIELDS.includes(dep.type)) {
          dep.error(
            `${dep.ident}: the component declares only peerDependencies and dependencies`,
          );
          continue;
        }
        if (
          dep.type === 'peerDependencies' &&
          !COMPONENT_PEERS.has(dep.ident)
        ) {
          dep.error(`move ${dep.ident} from peerDependencies to dependencies`);
          continue;
        }
        if (dep.type === 'dependencies' && COMPONENT_PEERS.has(dep.ident)) {
          dep.error(`move ${dep.ident} from dependencies to peerDependencies`);
          continue;
        }
        if (!semver.validRange(range)) {
          dep.error(`${dep.ident}: range ${range} is not a semver range`);
          continue;
        }
        if (!(dep.ident in COMPONENT_PINS) && !/^\^\d/.test(range)) {
          dep.error(
            `${dep.ident}: use a caret range, or add the pin and its reason to COMPONENT_PINS in yarn.config.cjs`,
          );
        }
        // Root devDependencies are left out of the licence records and the
        // App Lab notice, and every component dependency ships to the host.
        const rootDep = Yarn.dependency({
          workspace: root,
          ident: dep.ident,
          type: 'dependencies',
        });
        if (!rootDep) {
          dep.error(
            `${dep.ident} is a component dependency but not in root dependencies`,
          );
          continue;
        }
        const version = installedVersion(rootDep);
        if (!version) {
          dep.error(
            `${dep.ident}: no installed version found; run yarn install`,
          );
        } else if (!semver.satisfies(version, range)) {
          dep.error(
            `the repo installs ${dep.ident}@${version}, outside the component range ${range}`,
          );
        }
      }
    }

    const rootBinaries = new Set(
      fs.existsSync(ROOT_BIN) ? fs.readdirSync(ROOT_BIN) : [],
    );
    rootBinaries.delete('node');
    rootBinaries.delete('yarn');
    for (const workspace of Yarn.workspaces()) {
      if (workspace.cwd === '.') continue;
      for (const [name, script] of Object.entries(
        workspace.manifest.scripts ?? {},
      )) {
        for (const binary of bareRootBinaries(script, rootBinaries)) {
          workspace.error(
            `script "${name}" calls ${binary} directly; use \`yarn run -T ${binary}\``,
          );
        }
      }
    }
  },
};
