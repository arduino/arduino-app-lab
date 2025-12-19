import {
  AiMessageInteractions,
  AiUserPlan,
  GetUserRestrictionsRecap_Response,
  getUserRestrictionsRecapRequest,
  ORGANIZATION_HEADER,
  Plans,
} from '@cloud-editor-mono/infrastructure';

import { getAccessToken, noTokenReject } from '../arduino-auth';
import { getSpace } from '../space-storage';
import { CompileUsage } from './restrictionsApiService.type';

export async function retrieveUserRestrictionsRecap(
  user_id?: string,
): Promise<GetUserRestrictionsRecap_Response> {
  if (!user_id) {
    throw new Error('No user_id provided');
  }
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  const space = getSpace();

  return getUserRestrictionsRecapRequest(
    {
      user_id,
      header: space
        ? {
            [ORGANIZATION_HEADER]: space,
          }
        : undefined,
    },
    token,
  );
}

export function getCompileUsageExceeded(
  response: GetUserRestrictionsRecap_Response,
): boolean {
  const compileUsage = getCompileUsage(response);
  return compileUsage.usage >= compileUsage.limit;
}

function getCompileUsage(
  response: GetUserRestrictionsRecap_Response,
): CompileUsage {
  return {
    limit: response.limits.create_compilation_number_day,
    usage: response.usage.create_compilation_number_day_current,
  };
}

export function getCanUseOta(
  response: GetUserRestrictionsRecap_Response,
): boolean {
  return response.limits.ota > 0;
}

export function getCanShareToClassroom(
  response: GetUserRestrictionsRecap_Response,
): boolean {
  return response.plans?.some((plan) => plan === 'organization-member');
}

export function getAiUserPlan(
  response: GetUserRestrictionsRecap_Response,
): AiUserPlan {
  if (response.plans?.includes(Plans.ENTERPRISE)) {
    return Plans.ENTERPRISE;
  }
  if (
    response.plans?.includes(Plans.MAKER) ||
    response.plans?.includes(Plans.MAKER_PLUS) ||
    response.plans?.includes(Plans.CLASSROOM) ||
    response.plans?.includes(Plans.ARDUINO)
  ) {
    return Plans.MAKER;
  }
  return Plans.FREE;
}

export function getGenAiInteractions(
  response: GetUserRestrictionsRecap_Response,
): AiMessageInteractions {
  return {
    limit: response.limits.ai_interactions_months,
    usage: response.usage.ai_interactions_month_current ?? 0,
  };
}
