import { TagStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const codeBlockTags: TagStyle[] = [
  {
    tag: t.function(t.variableName),
    color: '#F39C12',
  },
  {
    tag: [t.variableName, t.paren, t.bracket, t.separator, t.operator],
    color: '#dae3e3',
  },
  {
    tag: t.constant(t.name),
    color: '#5beff4',
  },
  {
    tag: [t.labelName, t.literal],
    color: '#7f8c8d',
  },
  {
    tag: t.typeName,
    color: '#0CA1A6',
  },
  {
    tag: t.processingInstruction,
    color: '#afda00',
  },
  {
    tag: t.propertyName,
    color: '#ff7519',
  },
  {
    tag: t.keyword,
    color: '#C586C0',
  },
  {
    tag: t.comment,
    color: `#7f8c8d !important`,
  },
  {
    tag: t.number,
    color: '#7fcbcd',
  },
  {
    tag: t.string,
    color: '#00ab75',
  },
];
