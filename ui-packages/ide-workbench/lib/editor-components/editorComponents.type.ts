import { ComponentType, FC, SVGProps } from 'react';

/**
 * What the editor needs from an icon button. A host that injects its own
 * button maps these props onto it; the editor passes nothing else.
 */
export interface EditorIconButtonProps {
  /** Accessible name. A host that shows tooltips shows this text. */
  label: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
  onPress?: () => void;
  isDisabled?: boolean;
  /** Set only on buttons that toggle something. */
  isPressed?: boolean;
}

/**
 * Components a host can inject so the editor's controls match the host's own
 * UI. Anything not injected falls back to the package's copy.
 */
export interface EditorComponents {
  IconButton: ComponentType<EditorIconButtonProps>;
}
