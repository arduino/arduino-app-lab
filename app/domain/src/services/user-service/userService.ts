import {
  GetSettings_Response,
  showUserSettingsRequest,
  updateUserSettingsRequest,
} from '@cloud-editor-mono/infrastructure';

import { getAccessToken, noTokenReject } from '../arduino-auth';

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
