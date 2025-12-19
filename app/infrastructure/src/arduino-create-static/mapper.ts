import { GetAgentMetadataResponseData } from './arduinoCreateStatic.type';

export function mapGetAgentMetadataResponse(
  data: any,
): GetAgentMetadataResponseData {
  return {
    version: data.Version,
  };
}
