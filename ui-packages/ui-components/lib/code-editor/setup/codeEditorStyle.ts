import styles from '../../../public/shared.module.scss';
import typographyStyles from '../../typography/typography.module.scss';
import styleVars from '../code-editor-variables.module.scss';

export const editorViewStyle = {
  '.cm-scroller': {
    fontFamily: typographyStyles.robotoMonoFontFamily,
    fontSize: `calc(${styleVars.editorFontSizeVar} * 1px)`,
    lineHeight: '1.4',
    letterSpacing: '0.02em',
    overscrollBehavior: 'none',
  },
  '.cm-content': {
    width: 'calc(100% - 48px)',
    padding: '8px 16px',
    paddingBottom: `calc(${styleVars.editorPaddingBottomVar} * 1px)`,
  },
  '.cm-line': {
    padding: '0px',

    // Browsers stop painting ultra-long lines for memory reasons.
    // These 3D rules trick the browser into promoting the line to a dedicated GPU layer.
    // NOTE: can be improved by implementing a "show more" button for long lines
    transform: 'translateZ(0)',
    willChange: 'transform',
  },
  '.cm-line.cm-activeLine': {
    background: `${styles.editorActiveLineBackground}`,
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
    background: styles.editorBackground,
  },
  '.cm-gutters .cm-lineNumbers': {
    flexGrow: 1,
  },
  '.cm-gutters .cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px',
  },
  '.cm-gutters .cm-activeLineGutter': {
    background: 'none',
    color: styles.editorLinesForegroundActive,
  },
  '.cm-gutters .cm-foldGutter .cm-gutterElement': {
    opacity: 0,
  },
  '.cm-gutters:hover .cm-foldGutter .cm-gutterElement': {
    color: styles.editorLinesForegroundActive,
    opacity: 0.8,
  },
  // Lift CodeMirror's bottom-panel host out of the editor's flex flow so
  // the find-and-replace panel overlays the editor (top-right) instead of
  // pushing content up. Find-and-replace is the only registered panel, so
  // a blanket rule on `.cm-panels-bottom` is safe. `zIndex` mirrors
  // `$zIndex1` (z-indexes.scss).
  '& > .cm-panels-bottom': {
    position: 'absolute !important',
    top: '0 !important',
    left: '0 !important',
    right: '0 !important',
    bottom: 'auto !important',
    height: '0 !important',
    border: 'none !important',
    overflow: 'visible !important',
    pointerEvents: 'none',
    zIndex: 10000,
  },
  // Re-enable pointer events on the actual panel content (host div).
  '& > .cm-panels-bottom > *': {
    pointerEvents: 'auto',
  },
};

export const foldGutterStyle = {
  openText: '▾',
  closedText: '	▸',
};
