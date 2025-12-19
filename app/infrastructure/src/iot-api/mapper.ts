import {
  ArduinoDevicev2_IoTApi,
  CheckThingCert_IotApi,
  CheckThingCert_Response,
  ListDevicesV2_Response,
  ShowDeviceV2_Response,
  ShowThingV1Device_Response,
} from './iotApi.type';

export function mapShowDeviceV2Response(
  data: ArduinoDevicev2_IoTApi,
): ShowDeviceV2_Response {
  return {
    connectionType: data.connection_type,
    createdAt: data.created_at,
    deviceStatus: data.device_status,
    events: data.events,
    fqbn: data.fqbn,
    href: data.href,
    id: data.id,
    label: data.label,
    lastActivityAt: data.last_activity_at,
    latestWifiFwVersion: data.latest_wifi_fw_version,
    metadata: data.metadata,
    name: data.name,
    noSketch: data.no_sketch,
    organizationId: data.organization_id,
    otaAvailable: data.ota_available,
    otaCompatible: data.ota_compatible,
    requiredWifiFwVersion: data.required_wifi_fw_version,
    serial: data.serial,
    tags: data.tags,
    thing: data.thing,
    type: data.type,
    userId: data.user_id,
    webhooks: data.webhooks,
    wifiFwVersion: data.wifi_fw_version,
    issuerCa: data.issuer_ca,
    libVersion: data.lib_version,
  };
}

export function mapListDevicesV2Response(
  data: ArduinoDevicev2_IoTApi[],
): ListDevicesV2_Response {
  return data.map(mapShowDeviceV2Response);
}

export function mapShowThingDeviceResponse(
  data: ArduinoDevicev2_IoTApi,
): ShowThingV1Device_Response {
  return mapShowDeviceV2Response(data);
}

export function mapCheckThingCertResponse(
  data: CheckThingCert_IotApi,
): CheckThingCert_Response {
  return {
    requiredAction: data.required_action,
  };
}
