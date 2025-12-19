import {
  GetUserRestrictionsRecap_Response,
  GetUserRestrictionsRecap_RestrictionsApi,
} from './restrictionsApi.type';

export function mapGetUserRestrictionsRecap(
  data: GetUserRestrictionsRecap_RestrictionsApi,
): GetUserRestrictionsRecap_Response {
  return {
    limits: data.limits,
    plans: data.plans,
    usage: data.usage,
  };
}
