import { ArduinoUser } from '@bcmi-labs/art-auth';
import { createContext } from 'react';

export type AuthContextValue = {
  user?: ArduinoUser | null;
  isAuthInjected: boolean;
};

export const AuthContext = createContext<AuthContextValue>({
  isAuthInjected: false,
});
