/**
 * Which build this is, for the two places that need to know: debug logging and
 * one dev-only guard around a clipboard read.
 *
 * Read from the bundler's own env rather than injected. Threading a debug flag
 * through `CodeEditorLogic` would be heavier than the behaviour it controls,
 * and unlike a clipboard or a router there is no host *implementation* to
 * choose — only a build-time constant every bundler already provides.
 *
 * `import.meta.env` is defined by Vite, Rollup and esbuild. A host whose
 * bundler defines nothing reads `undefined` and therefore gets production
 * behaviour: no debug output, no dev-only branches. That is the safe default
 * for a published package.
 */
function mode(): string | undefined {
  return (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;
}

export const isDevelopmentBuild = (): boolean => mode() === 'development';

export const isProductionBuild = (): boolean => mode() === 'production';
