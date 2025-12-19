import {
  getAgentMetadataJson,
  GetAgentMetadataResponseData,
} from '@cloud-editor-mono/infrastructure';

export async function getAgentMetadata(): Promise<GetAgentMetadataResponseData> {
  return getAgentMetadataJson();
}
