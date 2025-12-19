import { escapeRegExp } from '@cloud-editor-mono/common';

import {
  BoardFlavourOptions,
  errorRegExGroupLiterals,
  isCompleteParsedError,
  ParsedError,
} from './builderApiService.type';

export const FILE_NAME_LENGTH_LIMIT = 36;

// ** copied from webide https://github.com/bcmi-labs/webide/blob/6d1c89c59c7400ef6d525d6eedff8a0e5018848c/src/app/views/editor/librariesSidebar/librariesSidebar.ctrl.js#L336
export const parseSemVer = (libName: string, inputString: string): string => {
  // es: libName = "lvgl"
  // inputString = "lvgl@9.4.0"   ->  "9.4.0"
  // inputString = "lvgl_9_2_2"   ->  "9.2.2"
  if (!inputString) return '';
  const atIndex = inputString.indexOf('@');
  if (atIndex !== -1) {
    return inputString.slice(atIndex + 1).replace(/_/g, '.');
  }
  // legacy
  const namePosition = inputString.indexOf(libName) + libName.length;
  const version = inputString.slice(namePosition);
  const slices = version.split('_');

  const part1 = slices.slice(0, 3).join('.');
  const part2 = slices.slice(3).join('.');
  return part2 ? `${part1}-${part2}` : part1;
};

const createErrorRegEx = (sketchName: string): RegExp =>
  new RegExp(
    `.*?${escapeRegExp(sketchName)}/(?<${
      errorRegExGroupLiterals[0]
    }>.+?.ino):(?<${errorRegExGroupLiterals[1]}>[0-9]+):(?<${
      errorRegExGroupLiterals[2]
    }>[0-9]+):.*error:`,
    'g',
  );

export const parseError = (
  input: string,
  sketchName: string,
): ParsedError[] => {
  const result: ParsedError[] = [
    ...input.matchAll(createErrorRegEx(sketchName)),
  ]
    .filter((m) => {
      const groups = m.groups;
      return groups && isCompleteParsedError(groups);
    })
    .map(({ groups }) => groups as ParsedError);

  return result;
};

// utils/mapper.ts (o dove sta oggi)
export const normalizeLibraryName = (
  input: string,
  version?: string,
): string => {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/[\s-.]+/g, '_');
  if (!version) return `${name}@`; // prefisso per parse: "lvgl@"
  return `${name}@${version.trim().replace(/_/g, '.')}`; // "lvgl@9.2.2"
};

export const createFlavourString = (options: BoardFlavourOptions): string => {
  const flavourStringComponents = options.map((m) => {
    return {
      key: m.id,
      value: m.variants.find((v) => v.selected)?.id,
    };
  });

  const flavourString = `:${flavourStringComponents
    .map((c) => `${c.key}=${c.value}`)
    .join(',')}`;

  return flavourString;
};

export function validateFileNameLimit(fileName: string): boolean {
  return fileName.length > FILE_NAME_LENGTH_LIMIT;
}

export function validateFileNameFormat(fileName: string): boolean {
  return fileName.match(/[^a-zA-Z0-9-_]{1}[^a-zA-Z0-9-_.]{0,35}/g) !== null;
}
