import { Config } from '@cloud-editor-mono/common';

import { httpGet } from '../fetch/fetch';
import { MandatoryUpdateJson, MandatoryUpdateList } from './appLabBucket.type';
import { mapGetMandatoryUpdatesListResponse } from './mapper';

export async function getMandatoryUpdatesListRequest(): Promise<MandatoryUpdateList> {
  const endpoint = '/Stable/mandatory-updates.json';
  const response = await httpGet<MandatoryUpdateJson>(
    Config.APP_LAB_BUCKET_URL,
    undefined,
    endpoint,
  );

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return mapGetMandatoryUpdatesListResponse(response);
}
