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
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              '@cloud-editor-mono/ui-components',
              '@cloud-editor-mono/ui-components/lib',
              '@cloud-editor-mono/ui-components/lib/index',
            ].map((name) => ({
              name,
              message:
                'Do not import the ui-components top-level barrel: it pulls every export (board images included) into the bundle. Use a relative import inside the package, or a deep import like @cloud-editor-mono/ui-components/lib/<module> from apps.',
            })),
          },
        ],
      },
    },
  ],
};
