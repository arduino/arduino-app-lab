import { ArduinoUser } from '@bcmi-labs/art-auth';
import {
  AiMessageInteractions,
  AiUserPlan,
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
  login?: () => Promise<void>;
  logout?: () => Promise<void>;
};

const authContextValue: AuthContextValue = {
  userNotTargetAudience: false,
  compileUsageExceeded: undefined,
  canUseOta: undefined,
  canUseGenAi: undefined,
  isAuthInjected: false,
  aiUserPlan: undefined,
  genAiInteractions: undefined,
};

export const AuthContext = createContext<AuthContextValue>(authContextValue);
