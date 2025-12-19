import {
  Body_Events,
  sendEvent,
  USER_CLAIM_ID,
} from '@cloud-editor-mono/infrastructure';

import {
  getAccessToken,
  injectedUser,
  noTokenReject,
  retrieveAuth0User,
} from '../arduino-auth';
import { getBrowser, getOS } from '../utils';

export async function sendAnalyticsEvent<T extends Body_Events>(
  payload: T,
): Promise<void> {
  let profile = injectedUser;

  if (!profile) {
    try {
      profile = await retrieveAuth0User();
    } catch (error) {
      console.error('Error retrieving user profile for event emission');
      return;
    }
  }

  if (!profile) {
    console.error('Tried to emit event without a user profile');
    return;
  }

  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const browser = getBrowser();
  const os = getOS();

  return sendEvent(payload, token, profile[USER_CLAIM_ID], browser, os);
}
