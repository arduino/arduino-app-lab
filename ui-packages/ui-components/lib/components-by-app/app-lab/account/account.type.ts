import { ArduinoUser } from '@bcmi-labs/art-auth';
import { EdgeImpulseUser } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

export type UseArduinoAccountLogic = () => {
  user?: ArduinoUser | null;
  login: (data?: { isFromAccount: boolean }) => Promise<void>;
  isLoginLoading: boolean;
  isLoginError: boolean;
  logout: () => Promise<void>;
  isLogoutLoading: boolean;
  isLogoutError: boolean;
  skip: () => void;
  skipped: boolean;
  dismissWelcomePage: () => void;
  isWelcomePageDismissed?: boolean;
};

export type UseEdgeImpulseAccountLogic = () => {
  user?: EdgeImpulseUser | null;
  login: () => Promise<void>;
  isLoginLoading: boolean;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};
