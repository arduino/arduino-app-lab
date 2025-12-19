import { Config } from '@cloud-editor-mono/common';

import { httpGetRaw } from '../fetch/fetch';
import { ReferenceCategory } from './referenceApi.type';

export async function getReferenceRequest(langCode: string): Promise<string>;
export async function getReferenceRequest(
  langCode: string,
  category: ReferenceCategory,
  itemPath: string,
): Promise<string>;
export async function getReferenceRequest(
  langCode: string,
  category?: ReferenceCategory,
  itemPath?: string,
): Promise<string> {
  let endpoint = `/raw/`;

  if (category && itemPath) {
    endpoint = `/${langCode}/${category}/${itemPath}` + endpoint;
  }

  const response = await httpGetRaw(Config.ARDUINO_REFERENCE_URL, endpoint);

  if (!response) {
    throw Error("Can't fetch reference");
  }
  return response.text();
}
