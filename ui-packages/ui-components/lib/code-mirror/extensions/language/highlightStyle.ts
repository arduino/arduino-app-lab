import { HighlightStyle, TagStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

import styles from '../../../../public/shared.module.scss';

export const customTags: TagStyle[] = [
  {
    tag: t.function(t.variableName),
    color: styles.editorSyntaxHighlightFunctions,
  },
  {
    tag: [t.variableName, t.paren, t.bracket, t.separator, t.operator],
    color: styles.editorSyntaxHighlightNeutral,
  },
  {
    tag: t.constant(t.name),
    color: styles.editorSyntaxHighlightConstants,
  },
  {
    tag: [t.labelName, t.literal],
    color: styles.editorSyntaxHighlightComments,
  },
  {
    tag: [t.comment],
    color: `${styles.editorSyntaxHighlightComments}!important`,
    // ** our keyword highlighting is flawed, we need `!important` to ensure comments are highlighted appropriately
    // ** this is a quick-n-dirty solution, alternatives are either computationally heavy or require a big rework
  },
  {
    tag: t.string,
    color: styles.editorSyntaxHighlightString,
  },
  {
    tag: t.number,
    color: styles.editorSyntaxHighlightNumeric,
  },
  {
    tag: t.typeName,
    color: styles.editorSyntaxHighlightVariables,
  },
  {
    tag: [t.processingInstruction, t.operator, t.keyword],
    color: styles.editorSyntaxHighlightStructures,
  },
  {
    tag: t.propertyName,
    color: styles.editorSyntaxHighlightDatatypes,
  },
];

export const highlightStyle: (style: TagStyle[]) => HighlightStyle = (style) =>
  HighlightStyle.define(style);
