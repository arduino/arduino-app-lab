import { ArduinoUser } from '@bcmi-labs/art-auth';

export interface PageProps {
  profile?: ArduinoUser;
  profileIsLoading?: boolean;
}
