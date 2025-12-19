import { CamelCasedProperties } from 'type-fest';

import { components, paths } from './ota-api';

//Params imported directly from the ota-api.d.ts paths
export type ListOtaParams_OtaApi = paths['/v1/ota']['get']['parameters'];
export type ShowOtaV1Params_OtaApi = paths['/v1/ota/any']['get']['parameters'];

//Declares possible states
export enum StatesEnum {
  //Intermediate OTA steps
  AVAILABLE = 'available',
  START = 'start',
  FETCH = 'fetch',
  FLASH = 'flash',
  REBOOT = 'reboot',
  FAIL = 'fail',
}
//Base schemas imported directly from the ota-api.d.ts
export type Ota_OtaApi = Omit<
  components['schemas']['model.Ota'],
  'error_reason'
> & {
  error_reason?: OtaV1_ErrorsStrings;
};
export type States_OtaApi = Omit<
  components['schemas']['handler.OtaState'],
  'state'
> & {
  state?: StatesEnum;
};

//Body schemas imported directly from the ota-api.d.ts
export type CreateOtaV1Body_OtaApi =
  components['schemas']['handler.PostOtaBody'];

export type Ota_Response = CamelCasedProperties<Ota_OtaApi>;

export type States_Response = CamelCasedProperties<States_OtaApi>;

export type ListOtaV1_OtaApi = {
  ota?: Ota_OtaApi[];
};

export type ListOtaV1_Response = {
  ota?: Ota_Response[];
};

export type CreateOtaV1_OtaApi = {
  ota?: Ota_OtaApi;
};

export type CreateOtaV1_Response = {
  ota?: Ota_Response;
};

export type ShowOtaV1_OtaApi = {
  ota?: Ota_OtaApi;
  states?: States_OtaApi[];
};

export type ShowOtaV1_Response = {
  ota?: Ota_Response;
  states?: States_Response[];
};

export enum OtaV1_Errors {
  NoCapableBootloaderFail = 'NoCapableBootloaderFail',
  NoOtaStorageFail = 'NoOtaStorageFail',
  OtaStorageInitFail = 'OtaStorageInitFail',
  OtaStorageOpenFail = 'OtaStorageOpenFail',
  OtaHeaderLengthFail = 'OtaHeaderLengthFail',
  OtaHeaderCrcFail = 'OtaHeaderCrcFail',
  OtaHeaderMagicNumberFail = 'OtaHeaderMagicNumberFail',
  ParseHttpHeaderFail = 'ParseHttpHeaderFail',
  UrlParseErrorFail = 'UrlParseErrorFail',
  ServerConnectErrorFail = 'ServerConnectErrorFail',
  OtaDownloadFail = 'OtaDownloadFail',
  OtaHeaderTimeoutFail = 'OtaHeaderTimeoutFail',
  HttpResponseFail = 'HttpResponseFail',
  OtaStorageEndFail = 'OtaStorageEndFail',
  StorageConfigFail = 'StorageConfigFail',
  LibraryFail = 'LibraryFail',
  ModemFail = 'ModemFail',
  ErrorOpenUpdateFileFail = 'ErrorOpenUpdateFileFail',
  ErrorWriteUpdateFileFail = 'ErrorWriteUpdateFileFail',
  ErrorReformatFail = 'ErrorReformatFail',
  ErrorUnmountFail = 'ErrorUnmountFail',
  ErrorRenameFail = 'ErrorRenameFail',
  CaStorageInitFail = 'CaStorageInitFail',
  CaStorageOpenFail = 'CaStorageOpenFail',
  CanceledByUser = 'CanceledByUser',
  Sha256Mismatch = 'Sha256Mismatch',
  Timeout = 'Timeout',
  Sha256Unknown = 'Sha256Unknown',
}

//Managed errors with custom panel
export enum ManagedOtaErrors {
  ErrorWriteUpdateFileFail = OtaV1_Errors.ErrorWriteUpdateFileFail,
  HttpResponseFail = OtaV1_Errors.HttpResponseFail,
  OtaDownloadFail = OtaV1_Errors.OtaDownloadFail,
  OtaHeaderCrcFail = OtaV1_Errors.OtaHeaderCrcFail,
  OtaStorageInitFail = OtaV1_Errors.OtaStorageInitFail,
  ServerConnectErrorFail = OtaV1_Errors.ServerConnectErrorFail,
  Sha256Unknown = OtaV1_Errors.Sha256Unknown,
  Sha256Mismatch = OtaV1_Errors.Sha256Mismatch,
}

export type OtaV1_ErrorsStrings = keyof typeof OtaV1_Errors;
