import { NonEmptyStringArray } from '@cloud-editor-mono/common';
import { ReferenceCategory } from '@cloud-editor-mono/infrastructure';

import { ReferencePath } from './reference.type';

export function calculateAbsolutePath(
  currentPath: string,
  relativePath: string,
): string {
  const absolutePathComponents =
    currentPath === '/' ? [] : currentPath.slice(1).split('/');
  const relativePathComponents = relativePath.split('/');

  for (const component of relativePathComponents) {
    if (component === '..') {
      absolutePathComponents.pop();
    } else if (component !== '') {
      absolutePathComponents.push(component);
    }
  }

  return `/${absolutePathComponents.join('/')}`;
}

export function referencePathFromString(path: string): ReferencePath {
  const components = path.split('/').filter((component) => !!component);
  const [category, ...rest] = components;

  const itemsPath =
    rest && rest.length > 1 ? (rest as NonEmptyStringArray) : null;

  return {
    category: category as ReferenceCategory,
    itemPath: itemsPath,
  };
}

export function referencePathToString(referencePath: ReferencePath): string {
  let path = `/${referencePath.category}`;
  if (referencePath.itemPath) {
    path += `/${referencePath.itemPath.join('/')}`;
  }
  return path;
}

/**
 * Splits a string by a given query; case-insensitive,
 * keeps the matched occurrences in the final array
 */
export function splitStringByQuery(name: string, query: string): string[] {
  if (name === '' || query === '') {
    return [];
  }

  const escapedQuery = query.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  return name.split(regex).filter((component) => component !== '');
}
