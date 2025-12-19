import { CamelCasedProperties } from 'type-fest';

import { components, operations } from './iot-api';

export type ListDevicesV2Params_IotApi =
  operations['devices_v2#list']['parameters'];

export type ShowDeviceV2Params_IoTApi =
  operations['devices_v2#show']['parameters'];

export type CheckThingCertParams_IotApi =
  operations['things_v2#checkSketch']['parameters'];

export interface CheckThingCert_IotApi {
  required_action: 'RELOAD_SKETCH' | 'NONE';
}

export type CheckThingCert_Response =
  CamelCasedProperties<CheckThingCert_IotApi>;

export type ArduinoDevicev2SimpleProperties_IotApi = Omit<
  components['schemas']['ArduinoDevicev2SimpleProperties'],
  'value'
> & {
  value: string; // TODO check why there is this type discrepancy with docs
};

export type ArduinoDevicev2_IoTApi = Omit<
  components['schemas']['ArduinoDevicev2'],
  'events'
> & {
  events?: ArduinoDevicev2SimpleProperties_IotApi[];
};

export type ShowDeviceV2_Response = CamelCasedProperties<
  Omit<ArduinoDevicev2_IoTApi, 'events'> & {
    events?: ArduinoDevicev2SimpleProperties_IotApi[];
  }
>;

export type ListDevicesV2_Response = ShowDeviceV2_Response[];

export type ShowThingV1DeviceParams_IoTApi =
  operations['things_v1#show']['parameters'];

export type ShowThingV1Device_Response =
  CamelCasedProperties<ArduinoDevicev2_IoTApi>;

export type SendDeviceV2OtaParams_IoTApi =
  operations['devices_v2_ota#send']['parameters'];

export type SendDeviceV2OtaBody_IoTApi =
  components['schemas']['devicev2.otabinaryurl'];
