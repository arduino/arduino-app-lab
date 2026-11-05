import { lazy } from 'react';

// These views bring App Lab dependencies (AI model dialogs, parse5) and are
// reached only through the content renderers below, for a brick file or
// rendered markdown, so they load on first use instead of at startup.
export const BrickDetail = lazy(() => import('../brick-detail/BrickDetail'));
export const MarkdownReader = lazy(
  () => import('../markdown-reader/MarkdownReader'),
);
