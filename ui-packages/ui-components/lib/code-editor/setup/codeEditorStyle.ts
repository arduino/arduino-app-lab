import { Config } from '@cloud-editor-mono/common';

import styles from '../../../public/shared.module.scss';
import typographyStyles from '../../typography/typography.module.scss';
import styleVars from '../code-editor-variables.module.scss';

const lightEditorViewStyle = {
  '& .cm-scroller': {
    fontFamily: typographyStyles.robotoMonoFontFamily,
    fontSize: `calc(${styleVars.editorFontSizeVar} * 1px)`,
    lineHeight: `calc(5px + ${styleVars.editorFontSizeVar} * 1px)`,
    letterSpacing: '0.02em',
  },
  '.cm-gutters': {
    borderRight: `1px`,
    backgroundColor: styles.editorLinesBackground,
    color: '#000',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    paddingLeft: '4px',
  },
  '.cm-foldGutter': {
    width: `calc((${styleVars.defaultFoldGutterWidth} + ${styleVars.editorFontSizeVar} - ${styleVars.defaultFontSize}) * 1px)`,
  },
  '.cm-foldGutter span': {
    padding: '0 !important',
  },
  '.cm-foldGutter .cm-gutterElement': {
    display: 'none',
  },
  '.cm-gutters:hover .cm-foldGutter .cm-gutterElement': {
    display: 'flex',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#F1C40F !important',
    color: '#374146 !important',
  },
  '.cm-line': {
    whiteSpace: 'break-spaces',
    wordBreak: 'break-word',
    padding: '0px',
  },
  '.cm-content': {
    width: 'calc(100% - 45px)',
    padding: '12px 28px 8px 28px',
  },
  '.cm-scroller': {
    overflowX: 'hidden',
  },
};

const darkEditorViewStyle = {
  ...lightEditorViewStyle,
  '.cm-gutters': {
    borderRight: `1px`,
    backgroundColor: styles.editorLinesBackground,
    color: styles.editorLinesForeground,
  },
  '.cm-activeLineGutter': {
    backgroundColor: styles.editorLinesBackgroundSelected,
  },
  '.cm-cursor': {
    borderLeft: '1.2px solid #dae3e3 !important',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#525D66 !important',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#485942',
  },
};

export const editorViewStyle = {
  ...(Config.APP_NAME === 'App Lab' // Temporary work-around for app lab (runtime switch to be impl.)
    ? darkEditorViewStyle
    : lightEditorViewStyle),
};

export const foldGutterStyle = {
  openText: '▾',
  closedText: '	▸',
};
