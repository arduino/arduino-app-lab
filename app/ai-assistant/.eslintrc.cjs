// Package-local overrides (merged with the repo-root config).
// .cjs because this package is "type": "module".
module.exports = {
  rules: {
    // TS already validates props via React.FC<Props>; the rule would otherwise
    // force a redundant `: Props` annotation on every destructured param.
    'react/prop-types': 'off',
  },
};
