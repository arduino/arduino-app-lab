import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { syntaxHighlighting } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { highlightSpecialChars } from '@codemirror/view';

import { customTags, highlightStyle } from './highlightStyle';

export enum FileExt {
  Ino = 'ino',
  H = 'h',
  Hpp = 'hpp',
  C = 'c',
  Cpp = 'cpp',
  Txt = 'txt',
  Py = 'py',
  Yaml = 'yaml',
  Other = '*',
}

type FileExtCodeMirrorExtensionMap = {
  [k in FileExt]: Extension;
};

const codeExts = [
  cpp(),
  syntaxHighlighting(highlightStyle(customTags), { fallback: true }),
  highlightSpecialChars(),
];

const pyCodeExts = [
  python(),
  highlightSpecialChars(),
  syntaxHighlighting(highlightStyle(customTags), { fallback: true }),
];
const yamlCodeExts = [
  yaml(),
  highlightSpecialChars(),
  syntaxHighlighting(highlightStyle(customTags), { fallback: true }),
];

export const fileExtCodeMirrorExtensionMap: FileExtCodeMirrorExtensionMap = {
  [FileExt.Ino]: codeExts,
  [FileExt.H]: codeExts,
  [FileExt.Hpp]: codeExts,
  [FileExt.C]: codeExts,
  [FileExt.Cpp]: codeExts,
  [FileExt.Py]: pyCodeExts,
  [FileExt.Yaml]: yamlCodeExts,
  [FileExt.Txt]: [],
  [FileExt.Other]: [],
};

export const languageToFileExtMap: { [key: string]: FileExt } = {
  cpp: FileExt.Cpp,
  arduino: FileExt.Cpp,
  c: FileExt.C,
  h: FileExt.H,
  hpp: FileExt.Hpp,
  ino: FileExt.Ino,
  python: FileExt.Py,
  py: FileExt.Py,
  yaml: FileExt.Yaml,
  yml: FileExt.Yaml,
  txt: FileExt.Txt,
};
