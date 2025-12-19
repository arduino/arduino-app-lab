import { PluginOption, UserConfig, UserConfigExport } from 'vite';

declare function libConfig(
  exportName: string,
  externalDependencies?: string[],
  plugins?: PluginOption[],
  options?: UserConfig,
  noUI?: boolean,
  vitestSetupFiles?: string[],
  envDir?: string,
): UserConfigExport;

declare function appConfig(
  port?: number,
  envDir?: string,
  pathLevel?: number,
  isWails?: boolean,
): UserConfigExport;

export { appConfig, libConfig };
