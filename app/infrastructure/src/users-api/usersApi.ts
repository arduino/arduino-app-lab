import { Config } from '@cloud-editor-mono/common';

import { httpGetRaw, httpJsonDelete, httpPostRaw } from '../fetch/fetch';
import { mapShowUserSettingsResponse } from './mapper';
import {
  CreateSettingsBody_UsersApi,
  GetSettings_Response,
  GetSettings_UsersApi,
} from './usersApi.type';

export async function showUserSettingsRequest(
  token: string,
): Promise<GetSettings_Response> {
  const endpoint = '/v1/users/settings';

  const response = await httpGetRaw(Config.USERS_API_URL, endpoint, token);

  if (!response || response.status !== 200) {
    return mapShowUserSettingsResponse({
      cloudeditor_optin: false,
      gen_ai: false,
    });
  }

  return mapShowUserSettingsResponse(
    (await response.json()) as GetSettings_UsersApi,
  );
}

// ? could be separated into two functions
export async function updateUserSettingsRequest(
  body: { optin: CreateSettingsBody_UsersApi['optin'] },
  token: string,
): Promise<boolean> {
  const endpoint = '/v1/users/settings';

  if (!Object.hasOwn(body, 'optin')) {
    throw new Error('`optin` value must be set');
  }

  if (body.optin === false) {
    const deleteResponse = await httpJsonDelete(
      Config.USERS_API_URL,
      undefined,
      endpoint,
      {
        key: 'cloudeditor_optin',
      },
      token,
    );

    if (!deleteResponse) {
      throw new Error(
        `Call to "${endpoint}" did not respond with the expected result`,
      );
    }

    return true; // ** deletion is enough to throw a 404 on next check which === opted out
  }

  const postResponse = await httpPostRaw(
    Config.USERS_API_URL,
    endpoint,
    {
      key: 'cloudeditor_optin',
      value: body.optin,
    },
    token,
  );

  if (
    !postResponse ||
    !(postResponse.status === 200 || postResponse.status === 201)
  ) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return true;
}
