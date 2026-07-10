import { FunctionComponent, SVGProps } from 'react';

import {
  customIcons,
  defaultFile,
  fileExtensions,
  fileNames,
  IconKey,
} from './manifest';
import { packIconComponents } from './seti';
import colorsData from './seti/colors.json';

type SvgComponent = FunctionComponent<
  SVGProps<SVGSVGElement> & { title?: string | undefined }
>;

const iconColors: Record<string, string> = colorsData.colors;
const DEFAULT_FILL = '#6d8086';

function resolveKey(fileName?: string): IconKey {
  if (!fileName) return defaultFile;
  const normalized = fileName.toLowerCase();
  if (fileNames[normalized]) return fileNames[normalized];
  const dot = normalized.lastIndexOf('.');
  const ext = dot >= 0 ? normalized.slice(dot + 1) : normalized;
  if (fileExtensions[ext]) return fileExtensions[ext];
  return defaultFile;
}

export function resolveFileIconComponent(fileName?: string): SvgComponent {
  const key = resolveKey(fileName);
  if (key in customIcons) return customIcons[key as keyof typeof customIcons];
  return packIconComponents[key] ?? packIconComponents[defaultFile];
}

function resolveFill(fileName?: string): string {
  const key = resolveKey(fileName);
  if (key in customIcons) return DEFAULT_FILL;
  return iconColors[key] ?? DEFAULT_FILL;
}

export interface FileIconProps extends SVGProps<SVGSVGElement> {
  fileName?: string;
}

export function FileIcon({
  fileName,
  width = 16,
  height = 16,
  fill,
  style,
  ...svgProps
}: FileIconProps): JSX.Element {
  const Icon = resolveFileIconComponent(fileName);
  const resolvedFill = fill ?? resolveFill(fileName);
  return (
    <Icon
      width={width}
      height={height}
      fill={resolvedFill}
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...svgProps}
    />
  );
}
