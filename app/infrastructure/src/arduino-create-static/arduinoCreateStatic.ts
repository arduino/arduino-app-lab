import { Config } from '@cloud-editor-mono/common';

import { httpGet } from '../fetch/fetch';
import { GetAgentMetadataResponseData } from './arduinoCreateStatic.type';
import { mapGetAgentMetadataResponse } from './mapper';

export async function getAgentMetadataJson(): Promise<GetAgentMetadataResponseData> {
  const endpoint = `/agent-metadata/agent-version.json`;

  const response = await httpGet(Config.AGENT_BUCKET_URL, {}, endpoint);

  return mapGetAgentMetadataResponse(response || { Version: '0.0.0' });
}
