import { lspStyles } from '../../code-mirror';
import styles from '../../theme/shared.module.scss';
import typographyStyles from '../../typography/typography.module.scss';
import styleVars from '../code-editor-variables.module.scss';

export const editorViewStyle = {
  '.cm-scroller': {
    fontFamily: typographyStyles.robotoMonoFontFamily,
    fontSize: `calc(${styleVars.editorFontSizeVar} * 1px)`,
    lineHeight: '1.4',
    letterSpacing: '0.02em',
    overflowX: 'hidden',
  },
  // Editor scrollbars: track matches the code canvas so it doesn't read as a
  // black/dark strip; grey thumb inset via a track-coloured padding-box border.
  // Overrides the global rule in index.scss.
  '.cm-scroller::-webkit-scrollbar': {
    width: '14px',
    height: '14px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    background: styles.editorBackground,
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: '#7f8c8d',
    border: `4px solid ${styles.editorBackground}`,
    backgroundClip: 'padding-box',
    borderRadius: '10px',
  },
  '.cm-content': {
    width: 'calc(100% - 48px)',
    padding: '8px 16px',
    paddingBottom: `calc(${styleVars.editorPaddingBottomVar} * 1px)`,
    // Default text colour for tokens the highlighter doesn't tag. rc-97 set this
    // on the editor container; main's restructure dropped it, leaving code text
    // to fall back to --text-default (a regression). Restore the neutral colour.
    color: styles.editorSyntaxHighlightNeutral,
  },
  '.cm-line': {
    // rc-97 behavior: wrap long lines instead of scrolling horizontally (no horizontal scrollbar means no Toolbar update-depth loop and no overscroll guard needed).
    whiteSpace: 'break-spaces',
    wordBreak: 'break-word',
    padding: '0px',
  },
  '.cm-line.cm-activeLine': {
    // Band across the active line: App Lab's look. Cloud Editor pins it transparent and marks the gutter instead (see .cm-activeLineGutter).
    background: styles.editorActiveLineBackground,
  },
  '.cm-line .cm-selectionMatch': {
    background: `${styles.editorSearchMatchBackground} !important`,
  },
  '.cm-line .cm-foldPlaceholder': {
    backgroundColor: '#7ECBCD !important',
    color: '#374146 !important',
    border: '1px solid #708385 !important',
    padding: '0 2px 0 1px',
  },
  '.cm-line .cm-searchMatch': {
    backgroundColor: styles.editorSearchMatchBackground,
  },
  '.cm-line .cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: styles.editorSearchMatchBackgroundActive,
  },
  '.cm-cursorLayer .cm-cursor': {
    borderLeft: `2px solid ${styles.editorCursorColor}`,
    borderColor: styles.editorCursorColor,
  },
  '.cm-selectionLayer .cm-selectionBackground': {
    background: `${styles.editorBackgroundSelection} !important`,
  },
  '&.cm-focused .cm-selectionLayer .cm-selectionBackground': {
    opacity: '1',
  },
  '&:not(.cm-focused) .cm-selectionLayer .cm-selectionBackground': {
    opacity: '0.5',
  },
  '.cm-gutters': {
    backgroundColor: 'unset',
    borderRight: 'none',
    minWidth: '48px',
    // Gutter blends into the toolbar above it rather than the code canvas.
    // --component-bg-below-1 (the toolbar background) resolves to #171e21 in
    // both apps: in CE it reads as a distinct strip beside the lighter #2c353a
    // canvas; in AL (canvas also #171e21) it's visually unchanged.
    background: 'var(--component-bg-below-1)',
  },
  '.cm-gutters .cm-lineNumbers': {
    flexGrow: 1,
  },
  '.cm-gutters .cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px',
  },
  '.cm-gutters .cm-activeLineGutter': {
    // Selected-line box on the active line number: Cloud Editor's look (rc-97).
    // App Lab pins it transparent and bands the line instead.
    background: styles.editorActiveLineGutterBackground,
    color: styles.editorLinesForegroundActive,
  },
  '.cm-gutters .cm-foldGutter .cm-gutterElement': {
    opacity: 0,
  },
  '.cm-gutters:hover .cm-foldGutter .cm-gutterElement': {
    color: styles.editorLinesForegroundActive,
    opacity: 0.8,
  },
  // `.cm-panels-bottom` is the CodeMirror host that wraps bottom-docked panels, like `.cm-find-replace-host`.
  // Make the host `position: static` (not a positioning context) so the
  // `.cm-find-replace-host` can anchor to `.cm-editor` instead of the host.
  '& > .cm-panels-bottom': {
    position: 'static !important',
    border: 'none !important',
    overflow: 'visible !important',
  },
  // Float only the find-and-replace panel as a per-panel top-right overlay, anchored to `.cm-editor`.
  // `zIndex` mirrors `$zIndex1`(z-indexes.scss).
  '& > .cm-panels-bottom > .cm-find-replace-host': {
    position: 'absolute !important',
    top: '0 !important',
    left: '0 !important',
    right: '0 !important',
    height: '0 !important',
    overflow: 'visible !important',
    pointerEvents: 'none',
    zIndex: 10000,
  },
  // Re-enable pointer events on the actual `cm-find-replace-host` content.
  '& > .cm-panels-bottom > .cm-find-replace-host > *': {
    pointerEvents: 'auto',
  },
  ...lspStyles,
};

export const foldGutterStyle = {
  openText: '▾',
  closedText: '	▸',
};
