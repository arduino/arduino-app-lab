import {
  ShowOtaV1_Response,
  StatesEnum,
} from '@cloud-editor-mono/infrastructure';

export const OTA_V1_STATE_AVAILABLE = {
  otaId: '12345',
  state: StatesEnum.AVAILABLE,
  timestamp: '2023-01-01T00:00:00Z',
};

export const OTA_V1_STATE_START = {
  otaId: '12345',
  state: StatesEnum.START,
  timestamp: '2023-01-01T00:10:00Z',
};

export const OTA_V1_STATE_FETCH = {
  otaId: '12345',
  state: StatesEnum.FETCH,
  timestamp: '2023-01-01T00:20:00Z',
};

export const OTA_V1_STATE_FLASH = {
  otaId: '12345',
  state: StatesEnum.FLASH,
  timestamp: '2023-01-01T00:30:00Z',
};

export const OTA_V1_STATE_REBOOT = {
  otaId: '12345',
  state: StatesEnum.REBOOT,
  timestamp: '2023-01-01T00:40:00Z',
};

export const OTA_V1_STATE_FAIL = {
  otaId: '12345',
  state: StatesEnum.FAIL,
  timestamp: '2023-01-01T00:50:00Z',
};

export const OTA_V1_RESPONSE_PENDING: ShowOtaV1_Response = {
  ota: {
    id: '12345',
    status: 'pending',
    startedAt: '2023-01-01T00:00:00Z',
    endedAt: '2023-01-01T01:00:00Z',
  },
  states: [],
};
