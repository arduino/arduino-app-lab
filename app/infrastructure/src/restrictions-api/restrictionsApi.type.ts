import { ORGANIZATION_HEADER } from '../utils';

export interface GetUserRecap_Params {
  user_id: string;
  header?: { [ORGANIZATION_HEADER]?: string };
}

interface Limits_RestrictionsApi {
  ai_interactions_months: number;
  background_mode: number;
  chrome_app: number;
  cloud_api: number;
  cloud_api_clients: number;
  cloud_api_ratelimit: number;
  cloud_devices_arduino: number;
  cloud_devices_arduino_type: number;
  cloud_devices_linux: number;
  cloud_devices_linux_type: number;
  cloud_devices_nonarduino: number;
  cloud_devices_nonarduino_type: number;
  cloud_pelion: number;
  cloud_properties: number;
  cloud_things: number;
  cloud_triggers: number;
  create_3rd_party_boards: number;
  create_chromeapp: number;
  create_compilation_day: number;
  create_compilation_month: number;
  create_compilation_number_day: number;
  create_disk: number;
  create_libraries_edit: number;
  create_sketches: number;
  create_sketches_disk: number;
  create_sketches_private: number;
  create_sketches_public: number;
  dashboard_sharing: number;
  data_retention_days: number;
  disk_sketches: number;
  edge_impulse: number;
  edge_impulse_pro: number;
  foundries: number;
  foundries_things: number;
  library_edit: number;
  linux_devices: number;
  ota: number;
  premium_widgets: number;
  private_sketches: number;
  properties: number;
  public_sketches: number;
  things: number;
  third_party_boards: number;
}

interface Usage_RestrictionsApi {
  ai_interactions_month_current: number;
  create_compilation_number_day_current: number;
  create_disk_libraries: number;
  create_disk_sketches: number;
  create_sketches: number;
}

export interface GetUserRestrictionsRecap_RestrictionsApi {
  limits: Limits_RestrictionsApi;
  plans: string[];
  usage: Usage_RestrictionsApi;
}

export type GetUserRestrictionsRecap_Response =
  GetUserRestrictionsRecap_RestrictionsApi;

export interface AiMessageInteractions {
  limit: number;
  usage: number;
}

export enum Plans {
  FREE = 'create-free',
  ENTRY = 'create-entry',
  MAKER_TRIAL = 'create-maker-trial',
  MAKER = 'create-maker',
  MAKER_PLUS = 'create-maker-plus',
  PRO = 'create-pro',
  CLASSROOM = 'cloud-classroom',
  ENTERPRISE = 'cloud-enterprise',
  ARDUINO = 'arduino',
  FOUNDRIES = 'foundries-plan',
  ORGANIZATION_MEMBER = 'organization-member',
}

export type AiUserPlan = Plans.FREE | Plans.MAKER | Plans.ENTERPRISE;
