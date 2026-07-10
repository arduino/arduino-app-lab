import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { indentUnit } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { highlightSpecialChars } from '@codemirror/view';

import { preprocArgCommentHighlight } from './preprocArgHighlight';

export enum FileExt {
  Ino = 'ino',
  H = 'h',
  Hpp = 'hpp',
  C = 'c',
  Cpp = 'cpp',
  Txt = 'txt',
  Py = 'py',
  Yaml = 'yaml',
  Js = 'js',
  Ts = 'ts',
  Json = 'json',
  Html = 'html',
  Css = 'css',
  Scss = 'scss',
  Other = '*',
}

type FileExtCodeMirrorExtensionMap = {
  [k in FileExt]: Extension;
};

const codeExts = [cpp(), highlightSpecialChars(), preprocArgCommentHighlight];
const pyCodeExts = [python(), highlightSpecialChars(), indentUnit.of('    ')];
const yamlCodeExts = [yaml(), highlightSpecialChars()];
const jsCodeExts = [javascript(), highlightSpecialChars()];
const htmlCodeExts = [html(), highlightSpecialChars()];
const cssCodeExts = [css(), highlightSpecialChars()];
const jsonCodeExts = [json(), highlightSpecialChars()];

export const fileExtCodeMirrorExtensionMap: FileExtCodeMirrorExtensionMap = {
  [FileExt.Ino]: codeExts,
  [FileExt.H]: codeExts,
  [FileExt.Hpp]: codeExts,
  [FileExt.C]: codeExts,
  [FileExt.Cpp]: codeExts,
  [FileExt.Py]: pyCodeExts,
  [FileExt.Yaml]: yamlCodeExts,
  [FileExt.Js]: jsCodeExts,
  [FileExt.Ts]: jsCodeExts,
  [FileExt.Html]: htmlCodeExts,
  [FileExt.Css]: cssCodeExts,
  [FileExt.Scss]: cssCodeExts,
  [FileExt.Json]: jsonCodeExts,
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
  js: FileExt.Js,
  ts: FileExt.Ts,
  html: FileExt.Html,
  css: FileExt.Css,
  scss: FileExt.Scss,
  json: FileExt.Json,
  txt: FileExt.Txt,
};
