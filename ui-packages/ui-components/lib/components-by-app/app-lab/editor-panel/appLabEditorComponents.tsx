import {
  EditorComponents,
  EditorIconButtonProps,
} from '@cloud-editor-mono/ide-workbench/lib/editor-components';

import {
  ButtonAppearance,
  ButtonSize,
  ButtonVariant,
} from '../essential/button';
import { IconButton } from '../essential/icon-button';

const AppLabEditorIconButton: React.FC<EditorIconButtonProps> = ({
  label,
  Icon,
  onPress,
  isDisabled,
  isPressed,
}: EditorIconButtonProps) => (
  <IconButton
    label={label}
    Icon={Icon}
    size={ButtonSize.XSmall}
    variant={ButtonVariant.Tertiary}
    appearance={ButtonAppearance.LowContrast}
    disabled={isDisabled}
    aria-pressed={isPressed}
    onClick={onPress && ((): void => onPress())}
  />
);

export const appLabEditorComponents: Partial<EditorComponents> = {
  IconButton: AppLabEditorIconButton,
};
