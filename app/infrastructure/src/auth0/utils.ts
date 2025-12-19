import { Config } from '@cloud-editor-mono/common';

// ** the below is "borrowed" from the Arduino `cloud-website` repo
interface DeploymentPath {
  /** The custom 4th level domain, used for customization purposes */
  customKey: string | undefined;
  /** The root of the application, adapted to the environment (used for external redirection on the same environment domain) */
  extRoot: string;
}

/**
 * The deployment path configuration, calculated at runtime.
 */
export const deploymentPath: DeploymentPath = ((): DeploymentPath => {
  // Check if we are on an Arduino domain (e.g. app.arduino.cc)
  const isArduinoDomain = window.location.origin.includes(
    `app.${Config.DOMAIN}.cc`,
  );

  return {
    // If we are on an Arduino domain, check if it's a custom one.
    customKey:
      isArduinoDomain && window.location.hostname.split('.').length === 4
        ? window.location.hostname.split('.')[0]
        : undefined,
    // If we're not running on a real Arduino domain, use the VITE_DOMAIN environment variable. Else, we can simply use the current origin.
    extRoot: !isArduinoDomain
      ? `https://app.${Config.DOMAIN}.cc`
      : window.location.origin,
  };
})();
