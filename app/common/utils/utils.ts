export function setCSSVariable(variable: string, value: string): void {
  document.documentElement.style.setProperty(variable, value);
}

export function getCSSVariable(variable: string): string {
  return document.documentElement.style.getPropertyValue(variable);
}

// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function trimFileExtension(input: string): string {
  return input.replace(/\.[^.]+$/, '');
}

export function assertNonNull<T>(
  arg: T,
  error = new Error('Argument is null or undefined.'),
): asserts arg is NonNullable<T> {
  if (arg === null || arg === undefined) {
    throw error;
  }
}

export const EmptyFn = (): void => undefined;

export const throwError = <T>(err: T): never => {
  throw err;
};

export const isMobileDevice = (): boolean => {
  const isMobileAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const isMobileScreen = screenWidth < 768 || screenHeight < 768;

  const isMobileTouch = 'ontouchstart' in window;

  return isMobileAgent || isMobileScreen || isMobileTouch;
};

// ** The below `load<X>` functions are "borrowed" from "cloud-website",
// ** they are used by `analyticsService.ts`, the logic of which also originates
// ** from "cloud-website" (see `domain/src/services/analytics-service/README.md`)
export function loadScript(
  src: string,
  id: string,
  async = false,
): Promise<unknown> {
  return new Promise((res, rej) => {
    if (document.getElementById(id)) return;

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = async;
    document.head.append(script);
    script.onload = res;
    script.onerror = rej;
  });
}

export function loadCSS(href: string): void {
  const fileref = document.createElement('link');
  fileref.rel = 'stylesheet';
  fileref.type = 'text/css';
  fileref.href = href;
  document.getElementsByTagName('head')[0].appendChild(fileref);
}

// ** The below is copied and slightly adapted from the now dead `arduino-fqbn.js` library
// ** given the lack of maintenance of the library it's best not to depend on it
export interface ParsedArduinoFqbnConfig {
  [key: string]: string;
}
interface ParsedArduinoFqbn {
  baseFqbn: string;
  packager: string;
  architecture: string;
  id: string;
  config: ParsedArduinoFqbnConfig;
}

export function parseArduinoFqbn(fqbn: string): ParsedArduinoFqbn {
  const parts = fqbn.split(':');

  if (parts.length > 4) {
    throw new Error(`Too many parts in fqbn provided: ${fqbn}`);
  }

  if (parts.length < 3) {
    throw new Error(`Missing parts in fqbn provided: ${fqbn}`);
  }

  const config: ParsedArduinoFqbnConfig = {};
  if (parts.length === 4) {
    const confParts = parts[3].split(',');
    for (const confPart of confParts) {
      const splitConfig = confPart.split('=');
      if (splitConfig.length !== 2) {
        throw new Error(`Invalid 'config' in fqbn provided: ${fqbn}`);
      }

      const [key, value] = splitConfig;
      config[key] = value;
    }
  }

  const packager = parts[0];
  const architecture = parts[1];
  const id = parts[2];

  return {
    baseFqbn: `${packager}:${architecture}:${id}`,
    packager,
    architecture,
    id,
    config,
  };
}

export function hasNavigator(
  window: Window,
): window is Window & { navigator: { serial: EventTarget } } {
  return 'navigator' in window;
}

export function extFromCommandlineString(string: string): string {
  const regEx = /\{build\.project_name\}\.(\w\w\w)\b/g;
  const result = regEx.exec(string);
  if (Array.isArray(result) && result.length > 0) {
    return result?.[1] ?? '';
  }
  return '';
}

export const IO_COMMAND_TIMEOUT = 5000;

export type FileLike = { name: string };
export const pickMainIno = <T extends FileLike>(files: T[]): T | undefined =>
  files.find((f) => f.name.toLowerCase().endsWith('.ino'));
