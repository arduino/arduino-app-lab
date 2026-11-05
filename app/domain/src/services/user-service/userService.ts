import {
  GetPolicies_UsersApi,
  GetSettings_Response,
  getUserPoliciesRequest,
  ORGANIZATION_HEADER,
  showUserSettingsRequest,
  updateUserSettingsRequest,
} from '@cloud-editor-mono/infrastructure';

import { getAccessToken, noTokenReject } from '../arduino-auth';
import { getSpace } from '../space-storage';

export async function requestOptOut(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  return updateUserSettingsRequest({ optin: false }, token);
}

export async function showUserSettings(): Promise<GetSettings_Response> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  return showUserSettingsRequest(token);
}

export async function retrieveUserPolicies(): Promise<GetPolicies_UsersApi> {
  const space = getSpace();
  if (!space) {
    throw new Error('Policies exist only for organization spaces');
  }

  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  return getUserPoliciesRequest(
    { header: { [ORGANIZATION_HEADER]: space } },
    token,
  );
}
