export let Config = {
  // Default vars
  MODE: import.meta.env.MODE,
  APP_NAME: import.meta.env.VITE_APP_NAME,
  APP_VERSION: import.meta.env.VITE_APP_VERSION,
  // App urls
  APP_ORIGIN: import.meta.env.VITE_APP_ORIGIN,
  ROUTING_BASE_URL: import.meta.env.VITE_ROUTING_BASE_URL,
  NEW_WINDOW_ORIGIN: import.meta.env.VITE_NEW_WINDOW_ORIGIN,
  // For development - origin of the expected monitor opener
  SERIAL_MONITOR_PARENT_ORIGIN: import.meta.env
    .VITE_SERIAL_MONITOR_PARENT_ORIGIN,
  // Auth options vars
  APP_URL: import.meta.env.VITE_APP_URL,
  AUTH_URL: import.meta.env.VITE_AUTH_URL,
  AUTH_ID: import.meta.env.VITE_AUTH_ID,
  AUTH_SCOPE: import.meta.env.VITE_AUTH_SCOPE,
  AUTH_AUDIENCE: import.meta.env.VITE_AUTH_AUDIENCE,
  REDIRECT_URI: import.meta.env.VITE_REDIRECT_URI,
  // Arduino Cloud vars
  CLOUD_HOME_URL: import.meta.env.VITE_CLOUD_HOME_URL,
  LOGOUT_URI: import.meta.env.VITE_LOGOUT_URI,
  ID_URL: import.meta.env.VITE_ID_URL,
  DIGITAL_STORE_URL: import.meta.env.VITE_DIGITAL_STORE_URL,
  CLOUD_CDN_URL: import.meta.env.VITE_CLOUD_CDN_URL,
  API_URL: import.meta.env.VITE_API_URL,
  WL_API_URL: import.meta.env.VITE_WL_API_URL,
  // Domain vars - for spaces
  DOMAIN: import.meta.env.VITE_DOMAIN,
  COOKIES_DOMAIN: import.meta.env.VITE_COOKIES_DOMAIN,
  // Core backends
  CREATE_API_URL: import.meta.env.VITE_CREATE_API_URL,
  LIBRARIES_API_URL_NEW: import.meta.env.VITE_LIBRARIES_NEW,
  CREATE_FAVORITE_NEW: import.meta.env.VITE_CREATE_API_URL,
  BUILDER_API_URL: import.meta.env.VITE_BUILDER_API_URL,
  BOARDS_API_URL: import.meta.env.VITE_BOARDS_API_URL,
  BUILDER_API_V2_URL: import.meta.env.VITE_BUILDER_API_V2_URL,
  BUILDER_API_V2_CF_CLIENT_ID: import.meta.env.VITE_BUILDER_V2_CF_CLIENT_ID,
  BUILDER_V2_CF_SECRET: import.meta.env.VITE_BUILDER_V2_CF_SECRET,
  IOT_API_URL: import.meta.env.VITE_IOT_API_URL,
  OTA_API_URL: import.meta.env.VITE_OTA_API_URL,
  USERS_API_URL: import.meta.env.VITE_USERS_API_URL,
  RESTRICTIONS_API_URL: import.meta.env.VITE_RESTRICTIONS_API_URL,
  ORCHESTRATOR_API_URL: import.meta.env.VITE_ORCHESTRATOR_API_URL,
  GEN_AI_API_URL: import.meta.env.VITE_GEN_AI_API_URL,
  // Misc backends
  CODE_FORMATTER_API_URL: import.meta.env.VITE_CODE_FORMATTER_API_URL,
  // Optin-out
  WEB_IDE_URL: import.meta.env.VITE_WEB_IDE_URL,
  BYPASS_OPTIN: import.meta.env.VITE_BYPASS_OPTIN,
  // Agent
  AGENT_FIRST_POSSIBLE_PORT: import.meta.env.VITE_AGENT_FIRST_POSSIBLE_PORT,
  AGENT_LAST_POSSIBLE_PORT: import.meta.env.VITE_AGENT_LAST_POSSIBLE_PORT,
  AGENT_UPDATE_URL_SUBSTRING: import.meta.env.VITE_AGENT_UPDATE_URL_SUBSTRING,
  AGENT_INFO_ENDPOINT: import.meta.env.VITE_AGENT_INFO_ENDPOINT,
  AGENT_UPDATE_ENDPOINT: import.meta.env.VITE_AGENT_UPDATE_ENDPOINT,
  AGENT_UPLOAD_ENDPOINT: import.meta.env.VITE_AGENT_UPLOAD_ENDPOINT,
  AGENT_INSTALLED_ENDPOINT: import.meta.env.VITE_AGENT_INSTALLED_ENDPOINT,
  AGENT_BOARDS_URL: import.meta.env.VITE_BOARDS_URL,
  AGENT_BUCKET_URL: import.meta.env.VITE_AGENT_BUCKET_URL,
  // Documentation & Support urls
  ARDUINO_SUPPORT_URL: import.meta.env.VITE_ARDUINO_SUPPORT_URL,
  ARDUINO_SUPPORT_DEVICES_TROUBLESHOOTING_URL: import.meta.env
    .VITE_ARDUINO_SUPPORT_DEVICES_TROUBLESHOOTING_URL,
  ARDUINO_SUPPORT_WEB_IDE_LOCAL_URL: import.meta.env
    .VITE_ARDUINO_SUPPORT_WEB_IDE_LOCAL_URL,
  ARDUINO_SUPPORT_AGENT_URL: import.meta.env.VITE_ARDUINO_SUPPORT_AGENT_URL,
  ARDUINO_CREATE_AGENT_GETTING_STARTED_URL: import.meta.env
    .VITE_ARDUINO_CREATE_AGENT_GETTING_STARTED_URL,
  SKETCH_SPEC_URL: import.meta.env.VITE_SKETCH_SPEC_URL,
  ARDUINO_STATUS_URL: import.meta.env.VITE_ARDUINO_STATUS_URL,
  ARDUINO_CONTACT_US_URL: import.meta.env.VITE_ARDUINO_CONTACT_US_URL,
  // Reference
  ARDUINO_REFERENCE_URL: import.meta.env.VITE_ARDUINO_REFERENCE_URL,
  ALGOLIA_API_KEY: import.meta.env.VITE_ALGOLIA_API_KEY,
  ALGOLIA_APP_ID: import.meta.env.VITE_ALGOLIA_APP_ID,
  ALGOLIA_REFERENCE_INDEX: import.meta.env.VITE_ALGOLIA_REFERENCE_INDEX,
  // Analytics
  GTM_ID: import.meta.env.VITE_GTM_ID,
  SEGMENT_SCRIPT: import.meta.env.VITE_SEGMENT_SCRIPT,
  SEGMENT_TOKEN: import.meta.env.VITE_SEGMENT_TOKEN,
  HF_CDN_URL: import.meta.env.VITE_HF_CDN_URL,
  HF_CDN_ENV: import.meta.env.VITE_HF_CDN_ENV,
  EVENTS_API_URL: import.meta.env.VITE_EVENTS_API_URL,
  EVENTS_BASE_TYPE: import.meta.env.VITE_EVENTS_BASE_TYPE,
  // Other
  DISABLE_WEB_WORKER: import.meta.env.VITE_DISABLE_WEB_WORKER,
  BYPASS_IOT_REDIRECT: import.meta.env.VITE_BYPASS_IOT_REDIRECT,
  FORCE_IS_BOARD: import.meta.env.VITE_FORCE_IS_BOARD,
  APP_LAB_BUCKET_URL: import.meta.env.VITE_APP_LAB_BUCKET_URL,
};

export function setGlobalConfig(vars: Partial<typeof Config>): void {
  Config = { ...Config, ...vars };
}

export const LocalConfig = {
  arduinoSupportWebIDELocal: (locale: string): string =>
    getLocalEnvVar(
      import.meta.env.VITE_ARDUINO_SUPPORT_WEB_IDE_LOCAL_URL,
      locale,
    ),
};

export const LOCAL_CONFIG_PLACEHOLDER = import.meta.env.VITE_LOCALE_PLACEHOLDER;

export function getLocalEnvVar(envVar: string, locale: string): string {
  return envVar.replace(
    new RegExp(`${LOCAL_CONFIG_PLACEHOLDER}`, 'g'),
    locale.toLocaleLowerCase(),
  );
}
