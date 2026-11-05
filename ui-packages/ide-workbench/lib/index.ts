// The package's public surface: the editor and its contracts.
//
// The leaf UI the editor renders (typography, tooltip, skeleton, essential/*)
// is deliberately NOT exported. It is the package's internal copy, kept so the
// package renders without ui-components; exporting it would make it API we owe
// consumers. ESLint bans it outside the package. A host that wants its own
// look injects components instead (see ./editor-components).
export * from './code-editor';
export * from './code-mirror';
export * from './editor-components';
export * from './editor-controls';
export { default as EditorImage } from './editor-image/EditorImage';
export * from './editor-panel';
export * from './editor-status';
export * from './editor-tabs-bar';
export { default as EditorToolbar } from './editor-toolbar/EditorToolbar';
export { default as FindAndReplaceSection } from './find-and-replace/FindAndReplaceSection';
// Not leaf UI: the i18n seam a renderer needs to format its own strings.
export { type FormatMessage, useI18n } from './i18n/useI18n';
