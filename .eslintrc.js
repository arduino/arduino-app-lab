// Guardrail for the injectable-logic-props pattern
// (ui-packages/ui-components/README.md, "Injectable Logic As Props"): a *Logic
// contract is a function the component invokes during its own render, so a
// consumer can supply the behaviour that runs there. An object type cannot be
// invoked, so it is not a logic prop.
//
// Only the shape is checked. Whether the function calls hooks is not part of
// the contract — the README says logic props *could* contain hooks — so a
// contract that just gathers values and returns them is valid, and that is the
// accepted cost of keeping one injection point per component.
//
// Only type aliases are matched. `*Logic` also names hook return types in this
// repo (`function useAppListLogic(): UseAppListLogic`), which are objects by
// design, so banning `interface *Logic` would reject 15 correct declarations.
// Telling the two apart needs the prop's type, which this rule cannot resolve.
const logicContractRules = [
  {
    selector: 'TSTypeAliasDeclaration[id.name=/Logic$/] > TSTypeLiteral',
    message:
      'A *Logic contract must be a function type: () => { ... }, because the component invokes it during its own render. An object type cannot be invoked, so it is plain props wearing the name — wrap it in a function, even if it only gathers values and returns them. See ui-packages/ui-components/README.md, "Injectable Logic As Props".',
  },
  {
    selector: 'TSTypeAliasDeclaration[id.name=/Logic$/] > TSIntersectionType',
    message:
      'A *Logic contract must be a function type. Intersect inside the return type instead: () => ReturnType<OtherLogic> & { ... }.',
  },
];

// ESLint does not merge `no-restricted-imports` across overrides: the last
// override that matches a file replaces the rule's options for that file. So
// each override below that sets the rule lists every restriction its files
// need, built from these pieces, instead of relying on an earlier override.
const appLabBoundary = {
  group: ['**/components-by-app/app-lab', '**/components-by-app/app-lab/**'],
  message:
    'Shared ui-components code must not import App Lab-specific code (docs/adr/0002-editor-panel-content-injection.md). Inject it through props instead, e.g. EditorPanel contentRenderers.',
};

const uiComponentsBarrel = [
  '@cloud-editor-mono/ui-components',
  '@cloud-editor-mono/ui-components/lib',
  '@cloud-editor-mono/ui-components/lib/index',
].map((name) => ({
  name,
  message:
    'Do not import the ui-components top-level barrel: it pulls every export (board images included) into the bundle. Use a relative import inside the package, or a deep import like @cloud-editor-mono/ui-components/lib/<module> from apps.',
}));

// The package keeps its own copy of the leaf UI it renders, so that it can be
// installed without ui-components. That copy is internal: code outside the
// package uses ui-components' own leaf UI.
const workbenchLeafUi = {
  group: [
    'essential',
    'typography',
    'i18n',
    'tooltip',
    'skeleton',
    'context-menu',
    'common',
  ].flatMap((dir) => [
    `@cloud-editor-mono/ide-workbench/lib/${dir}`,
    `@cloud-editor-mono/ide-workbench/lib/${dir}/**`,
    `@bcmi-labs/ide-workbench/lib/${dir}`,
    `@bcmi-labs/ide-workbench/lib/${dir}/**`,
    // The relative escape ('../../ide-workbench/lib/...') names no package.
    `**/ide-workbench/lib/${dir}`,
    `**/ide-workbench/lib/${dir}/**`,
  ]),
  message:
    "This is the ide-workbench package's internal copy of the leaf UI (docs/adr/0002). Import ui-components' own copy instead: a relative path inside ui-components, @cloud-editor-mono/ui-components/lib/<module> elsewhere.",
};

module.exports = {
  root: true,
  env: {
    browser: true,
    amd: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:prettier/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:storybook/recommended',
  ],
  plugins: ['simple-import-sort', 'prettier', 'jsx-a11y', 'formatjs'],
  rules: {
    'prettier/prettier': [
      'error',
      {},
      {
        usePrettierrc: true,
      },
    ],
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-return-await': 'error',
    'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
    'react/react-in-jsx-scope': 'off',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
    'formatjs/enforce-description': ['error', 'literal'],
    'formatjs/enforce-default-message': ['error', 'literal'],
    'formatjs/enforce-placeholders': 'error',
    'formatjs/no-multiple-whitespaces': 'error',
    'formatjs/enforce-id': 'error',
  },
  overrides: [
    {
      files: ['*.ts', '*.mts', '*.cts', '*.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'no-restricted-syntax': ['error', ...logicContractRules],
      },
    },
    {
      // ADR-0002: the ide-workbench package must stay agnostic in BOTH
      // directions — it may depend on workspace leaf packages (images,
      // common, arduino-sass), never on ui-components, which depends back
      // on it. The design-system leaves it renders live inside it since
      // ui-primitives was folded in.
      // The only sanctioned exception is the shared theme-token stylesheet
      // (scss, not linted here).
      files: [
        'ui-packages/ide-workbench/lib/**/*.ts',
        'ui-packages/ide-workbench/lib/**/*.tsx',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              // ui-components in both of its module names: the alias and the
              // published name, which resolves from inside the package through
              // node_modules/@bcmi-labs/.
              {
                name: '@cloud-editor-mono/ui-components',
                message:
                  'The ide-workbench package must not depend on ui-components (docs/adr/0002, phase 4a): ui-components consumes ide-workbench, not vice versa. Keep it self-contained, or inject through the renderer/logic contracts.',
              },
              {
                name: '@bcmi-labs/cloud-editor-ui-components',
                message:
                  'The ide-workbench package must not depend on ui-components (docs/adr/0002, phase 4a): ui-components consumes ide-workbench, not vice versa. Keep it self-contained, or inject through the renderer/logic contracts.',
              },
            ],
            patterns: [
              appLabBoundary,
              {
                // Now includes /public: the package owns its theme surface
                // (lib/theme/shared.module.scss), so the token stylesheet
                // exemption that used to sit here is gone.
                // The '**/ui-components/**' entries catch the relative escape
                // ('../../ui-components/lib/...'), which names no package at
                // all and so is invisible to the paths list above.
                group: [
                  '@cloud-editor-mono/ui-components/lib/**',
                  '@cloud-editor-mono/ui-components/public/**',
                  '@bcmi-labs/cloud-editor-ui-components/**',
                  '**/ui-components/lib/**',
                  '**/ui-components/public/**',
                ],
                message:
                  'The ide-workbench package must not depend on ui-components (docs/adr/0002, phase 4a): ui-components consumes ide-workbench, not vice versa. Keep it self-contained, or inject through the renderer/logic contracts.',
              },
              {
                // The app layer, in both of its module names — the alias and
                // the published name — plus the relative escape. Reached
                // historically for the clipboard and the external-link opener;
                // both are injected now.
                group: [
                  '@cloud-editor-mono/domain',
                  '@cloud-editor-mono/domain/**',
                  '@bcmi-labs/cloud-editor-domain',
                  '@bcmi-labs/cloud-editor-domain/**',
                  '**/app/domain/**',
                  '**/app/infrastructure/**',
                  '**/app/core-ui/**',
                  '**/services-by-app/**',
                ],
                message:
                  'The ide-workbench package must not depend on the app layer (docs/adr/0002): its services are app-specific. Take the capability as a parameter on CodeEditorLogic (see EditorClipboard / openExternalLink) and let the host inject it.',
              },
            ],
          },
        ],
      },
    },
    {
      // Everything outside the package. The overrides below replace this one
      // for their files, so each of them repeats workbenchLeafUi.
      files: ['**/*.ts', '**/*.tsx'],
      excludedFiles: ['ui-packages/ide-workbench/**'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [workbenchLeafUi] }],
      },
    },
    {
      // The ui-components top-level barrel re-exports cloud-editor-only
      // components (e.g. DeviceAssociationDialog and all its board images),
      // so importing it from inside the package or from App Lab code drags
      // every export into the App Lab bundle. Deep imports like
      // '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab'
      // remain allowed. Enforced in CI by
      // app/core-ui/src/architecture/barrelImports.test.ts.
      files: [
        'ui-packages/ui-components/**/*.{ts,tsx}',
        'app/core-ui/src/app-lab/**/*.{ts,tsx}',
        // App Lab imports the infrastructure barrel directly, so all of that layer
        // reaches its bundle; it reaches app/domain through deep service entries.
        // Both are covered whole: no service layer has a reason to pull the barrel.
        'app/domain/**/*.{ts,tsx}',
        'app/infrastructure/**/*.{ts,tsx}',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          { paths: uiComponentsBarrel, patterns: [workbenchLeafUi] },
        ],
      },
    },
    {
      // ADR-0002: the shared UI library must stay app-agnostic. Only the
      // App Lab buckets may import from components-by-app/app-lab;
      // everything else receives app-specific code through injection
      // (e.g. EditorPanel's contentRenderers / logic props).
      files: [
        'ui-packages/ui-components/lib/**/*.ts',
        'ui-packages/ui-components/lib/**/*.tsx',
      ],
      excludedFiles: [
        'ui-packages/ui-components/lib/components-by-app/app-lab/**',
        'ui-packages/ui-components/lib/dialogs/app-lab/**',
        // Imports the App Lab tooltip and is used only by App Lab dialogs; it
        // belongs in components-by-app/app-lab. Listed here until it moves.
        'ui-packages/ui-components/lib/error-banner/ErrorBanner.tsx',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: uiComponentsBarrel,
            patterns: [appLabBoundary, workbenchLeafUi],
          },
        ],
      },
    },
  ],
};
