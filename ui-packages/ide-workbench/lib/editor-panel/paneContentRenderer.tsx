import { ReactElement } from 'react';

import EditorImage from '../editor-image/EditorImage';
import { SUPPORTED_IMAGE_TYPES } from '../editor-tabs-bar';
import { EditorPanelFile } from './editorPanel.type';

/**
 * Everything a pane content renderer can know about the pane it fills.
 * Built by EditorPanel once per pane (A = left, B = right/split) from the
 * injected EditorPanelLogic, so renderers stay pure functions of this
 * context.
 */
export interface PaneContentContext {
  file: EditorPanelFile;
  paneId: 'A' | 'B';
  readOnly?: boolean;
  onCopyCode?: () => void;
  openExternalLink?: (url: string) => void;
  /** Pane-scoped markdown write/preview state (pane B receives the
   * splitPane* equivalents). */
  shouldRenderMarkdown?: boolean;
  /**
   * Opaque app-owned per-pane state (EditorPanelLogic.paneExtras). Only
   * meaningful to the app-injected renderers that know its concrete type.
   */
  extras?: unknown;
  classes?: {
    editorImage?: string;
  };
}

/**
 * A candidate content for an editor pane. EditorPanel walks its renderer
 * list in order and mounts the first one whose `match` accepts the pane
 * context; when none match, the pane falls back to the CodeEditor.
 *
 * Apps extend EditorPanel by prepending renderers via the
 * `contentRenderers` prop instead of adding file-type branches inside the
 * shared component.
 */
export interface PaneContentRenderer {
  /** Stable identifier, used for debugging and deduplication. */
  id: string;
  match: (ctx: PaneContentContext) => boolean;
  // ReactElement rather than the global JSX.Element: React 19's types
  // drop the global JSX namespace, and this contract must survive the
  // React 19 migration of the extracted package (ADR-0002).
  render: (ctx: PaneContentContext) => ReactElement;
}

const imageContentRenderer: PaneContentRenderer = {
  id: 'image',
  match: ({ file }) => SUPPORTED_IMAGE_TYPES.includes(`.${file.ext}`),
  render: ({ file, classes }) => (
    <EditorImage
      key={file.id}
      data={file.getData()}
      classes={{ container: classes?.editorImage }}
      extension={file.ext === 'svg' ? `${file.ext}+xml` : file.ext}
    />
  ),
};

export const defaultContentRenderers: PaneContentRenderer[] = [
  imageContentRenderer,
];

/**
 * Returns the content of the first matching renderer, or null when the
 * pane should fall back to the CodeEditor.
 */
export const resolvePaneContent = (
  renderers: PaneContentRenderer[],
  ctx: PaneContentContext,
): ReactElement | null => {
  const renderer = renderers.find((candidate) => candidate.match(ctx));
  return renderer ? renderer.render(ctx) : null;
};
