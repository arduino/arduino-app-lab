import {
  CreateOtaV1_OtaApi,
  CreateOtaV1_Response,
  ListOtaV1_OtaApi,
  ListOtaV1_Response,
  Ota_OtaApi,
  Ota_Response,
  ShowOtaV1_OtaApi,
  ShowOtaV1_Response,
  States_OtaApi,
  States_Response,
} from './otaApi.type';

function mapOtaV1(data: Ota_OtaApi): Ota_Response {
  return {
    deviceId: data.device_id,
    endedAt: data.ended_at,
    errorReason: data.error_reason,
    id: data.id,
    sha256: data.sha256,
    startedAt: data.started_at,
    status: data.status,
    firmwareSize: data.firmware_size,
  };
}

function mapStatesV1(data: States_OtaApi): States_Response {
  return {
    state: data.state,
    stateData: data.state_data,
    timestamp: data.timestamp,
  };
}

export function mapListOtaV1Response(
  data: ListOtaV1_OtaApi,
): ListOtaV1_Response {
  return { ota: data.ota?.map(mapOtaV1) };
}

export function mapShowOtaV1Response(
  data: ShowOtaV1_OtaApi,
): ShowOtaV1_Response {
  return {
    ota: data.ota ? mapOtaV1(data.ota) : undefined,
    states: data.states?.map(mapStatesV1),
  };
}

export function mapCreateOtaV1Response(
  data: CreateOtaV1_OtaApi,
): CreateOtaV1_Response {
  return { ota: data.ota ? mapOtaV1(data.ota) : undefined };
}
