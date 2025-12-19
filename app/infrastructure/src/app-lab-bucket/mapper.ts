import { MandatoryUpdateJson, MandatoryUpdateList } from './appLabBucket.type';

export function mapGetMandatoryUpdatesListResponse(
  data: MandatoryUpdateJson,
): MandatoryUpdateList {
  return data.packages;
}
