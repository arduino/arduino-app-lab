export interface ArduinoBuilderFile {
  data?: string;
  href?: string;
  last_modified?: string;
  mimetype?: string;
  name?: string;
  path?: string;
}

export interface ArduinoBuilderExtrafile {
  filename?: string;
  hex?: string;
}
export interface ArduinoBuilderExtrafileV2 {
  filename: string;
  data: string;
}
