//This type ColorValueHex is not extensive, it avoids rgba, hsl, hsla, etc. But would not check for a valid hex color.
export type ColorValueHex = `#${string}`;

export interface AppTagProps {
  text: string;
  Icon?: React.FunctionComponent<React.SVGProps<SVGSVGElement>> | string;
  color?: ColorValueHex;
  className?: {
    container: string;
    'icon-container': string;
    icon: string;
    'text-container': string;
    text: string;
  };
  selected?: boolean;
  onClick?: () => void;
}
