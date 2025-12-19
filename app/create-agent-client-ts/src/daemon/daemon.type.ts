export enum DaemonProtocols {
  HTTP = 'http',
  HTTPS = 'https',
}

export interface DaemonConfig {
  protocolToUse: DaemonProtocols;
  useV2: boolean;
}
