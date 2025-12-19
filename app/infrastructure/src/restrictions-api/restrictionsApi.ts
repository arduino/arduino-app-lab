import { Config } from '@cloud-editor-mono/common';

import { httpGet } from '../fetch/fetch';
import { mapGetUserRestrictionsRecap } from './mapper';
import {
  type GetUserRecap_Params,
  GetUserRestrictionsRecap_Response,
} from './restrictionsApi.type';

export async function getUserRestrictionsRecapRequest(
  params: GetUserRecap_Params,
  token: string,
): Promise<GetUserRestrictionsRecap_Response> {
  const { header } = params;

  const endpoint = `/v1/recap/${params.user_id}`;
  const response = await httpGet<GetUserRestrictionsRecap_Response>(
    Config.RESTRICTIONS_API_URL,
    undefined,
    endpoint,
    token,
    undefined,
    header,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGetUserRestrictionsRecap(response);
}
