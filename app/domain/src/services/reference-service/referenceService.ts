import { Config } from '@cloud-editor-mono/common';
import {
  getReferenceRequest,
  ReferenceCategory,
  searchReferenceIndex,
} from '@cloud-editor-mono/infrastructure';
import {
  CategoryTree,
  ReferenceEntry,
  ReferenceItem,
  ReferencePath,
  ReferenceSearchItem,
  ReferenceSearchResult,
} from '@cloud-editor-mono/ui-components';
import { get, set } from 'lodash';

import { cleanReferenceItemTemplate, isReferenceCategory } from './utils';

export async function getReferenceCategoriesTree(
  languageCode = 'en',
): Promise<[CategoryTree, Map<string, ReferenceEntry>]> {
  const rawReference = await getReferenceRequest(languageCode);

  const parser = new DOMParser();
  const dom = parser.parseFromString(rawReference, 'text/html');
  const allLinks = dom.querySelectorAll('li > a');

  /**
    getReferenceRequest returns a page with the reference entries as links.
    With this data we build two objects:
    - A map of all items to store all urls and labels of every reference entries
      This is useful to get a entry label from a path, or to perform local search on every item
    - Create a tree that divides main links in categories and subcategories. 
      This is useful to render the main links in the category view with subsections. 
      Note that subcategories are part of the path of the item, but does not render any content.
   */

  const allEntries = new Map<string, ReferenceEntry>();

  const tree: CategoryTree = {
    [ReferenceCategory.Functions]: new Map(),
    [ReferenceCategory.Variables]: new Map(),
    [ReferenceCategory.Structure]: new Map(),
  };

  for (const link of Array.from(allLinks)) {
    const href = link.getAttribute('href');
    const label = link.textContent;
    if (!href || !label) {
      continue;
    }

    // Get the internal path of the entry
    // Example: functions/digital-io/digitalwrite
    const path = href
      .replace('/language-reference/en/', '')
      .replace('/raw', '');

    allEntries.set(path, { href, label });

    const [category, subcategory, item, ...rest] = path.split('/');

    // Entries path can get deeper of 3 levels.
    // For the category view, we discard these items as they're accessible within the item itself
    // See subsections of https://language-reference.arduino.cc/language-reference/en/variables/data-types/stringObject
    if (rest && rest.length > 0) continue;

    if (!category || !subcategory || !item) continue;
    if (!isReferenceCategory(category)) continue;

    const subcategoryLabelFromID = (id: string): string => {
      switch (id) {
        case 'digital-io':
          return 'Digital I\\O';
        case 'analog-io':
          return 'Analog I\\O';
        case 'advanced-io':
          return 'Advanced I\\O';
        case 'usb':
          return 'USB';
        case 'wifi':
          return 'WiFi';
        default:
          return id.replaceAll('-', ' ');
      }
    };

    const categoryMap = tree[category];
    if (!categoryMap.has(subcategory)) {
      categoryMap.set(subcategory, {
        label: subcategoryLabelFromID(subcategory),
        entries: new Map(),
      });
    }
    const subcategoryObj = categoryMap.get(subcategory)!;
    subcategoryObj.entries.set(item, { href, label });
  }

  return [tree, allEntries];
}

export async function getReferenceItemTemplate(
  path: ReferencePath,
  languageCode = 'en',
): Promise<ReferenceItem> {
  if (!path.itemPath) {
    throw Error('Reference path not valid');
  }
  const rawReference = await getReferenceRequest(
    languageCode,
    path.category,
    path.itemPath.join('/'),
  );

  const parser = new DOMParser();
  const dom = parser.parseFromString(rawReference, 'text/html');

  cleanReferenceItemTemplate(dom);

  const template = dom.body.innerHTML;

  return { template };
}

export async function searchReferenceItem(
  query: string,
): Promise<ReferenceSearchResult> {
  const searchResponse = await searchReferenceIndex(query);

  // Group search results by categories and subcategories
  return searchResponse.hits.reduce((referenceSearchResult, hit) => {
    const { title, objectID } = hit;

    const baseUrl = `${Config.ARDUINO_REFERENCE_URL}/en/language/`;
    const pathComponents = hit.objectID.replace(baseUrl, '').split('/');
    const category = pathComponents[0] as ReferenceCategory;
    const subcategory = pathComponents[1];

    const subcategoryHits = get(
      referenceSearchResult,
      [category, subcategory],
      [] as ReferenceSearchItem[],
    );
    subcategoryHits.push({
      title,
      path: `/language/${objectID.replace(baseUrl, '')}`,
    });
    return set(referenceSearchResult, [category, subcategory], subcategoryHits);
  }, {} as ReferenceSearchResult);
}
