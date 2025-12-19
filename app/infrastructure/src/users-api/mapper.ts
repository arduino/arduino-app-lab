import { GetSettings_Response, GetSettings_UsersApi } from './usersApi.type';

export function mapShowUserSettingsResponse(
  data: GetSettings_UsersApi,
): GetSettings_Response {
  return {
    optin: data.cloudeditor_optin,
    genAi: data.gen_ai,
  };
}
