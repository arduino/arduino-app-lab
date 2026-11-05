import { ArduinoUser } from '@bcmi-labs/art-auth';
import {
  AiMessageInteractions,
  AiUserPlan,
  GetPolicies_UsersApi,
} from '@cloud-editor-mono/infrastructure';
import { createContext } from 'react';

export type AuthContextValue = {
  user?: ArduinoUser | null; // null represents signed out user, in read only mode
  userNotTargetAudience: boolean;
  compileUsageExceeded?: boolean;
  canUseOta?: boolean;
  canUseGenAi?: boolean;
  canShareToClassroom?: boolean;
  isAuthInjected: boolean;
  aiUserPlan?: AiUserPlan;
  genAiInteractions?: AiMessageInteractions;
  isViewMode: boolean;
  isOrganizationSpace: boolean;
  policies?: GetPolicies_UsersApi['policies'];
  policiesAreLoading: boolean;
};

const authContextValue: AuthContextValue = {
  userNotTargetAudience: false,
  compileUsageExceeded: undefined,
  canUseOta: undefined,
  canUseGenAi: undefined,
  isAuthInjected: false,
  aiUserPlan: undefined,
  genAiInteractions: undefined,
  isViewMode: false,
  isOrganizationSpace: false,
  policies: undefined,
  policiesAreLoading: false,
};

export const AuthContext = createContext<AuthContextValue>(authContextValue);
