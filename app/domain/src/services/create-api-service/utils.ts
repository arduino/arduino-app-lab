import { WretchError } from 'wretch/types';

import { DEFAULT_SECRETS_FULL_FILENAME } from '../secrets-service/utils';

export const SKETCH_META_FILE = 'sketch.json';
export const NON_USER_FILES = [SKETCH_META_FILE, DEFAULT_SECRETS_FULL_FILENAME];

export function isHiddenFile<T extends { path: string; name: string }>(
  file: T,
): boolean {
  return NON_USER_FILES.some((nonUserFile) => file.path.includes(nonUserFile));
}

// ** copied from web IDE
export function getResourceOwner(path: string): string {
  const start = path.indexOf(':') + 1;
  let end = path.indexOf('/sketches_v2');
  if (end === -1) {
    end = path.indexOf('/libraries_v2');
  }

  return path.substring(start, end);
}

const ERROR_MSG_PRIVATE_ASSET_REQUESTED_WITH_ORG_ID =
  'cannot access resources from a private space';

export type WretchErrorWithMessage = Omit<WretchError, 'message'> & {
  message?: { detail?: string };
  path?: string;
};
export function isPrivateResourceRequestWithOrgIdError(
  error: unknown,
  customCondition?: (errorCause: WretchErrorWithMessage) => boolean,
): boolean {
  const errCause = (error as Error).cause as WretchErrorWithMessage;

  const defaultConditional =
    errCause.message?.detail?.toLowerCase() ===
    ERROR_MSG_PRIVATE_ASSET_REQUESTED_WITH_ORG_ID;

  return customCondition
    ? errCause.status === 401 &&
        (customCondition(errCause) || defaultConditional)
    : errCause.status === 401 && defaultConditional;
}
