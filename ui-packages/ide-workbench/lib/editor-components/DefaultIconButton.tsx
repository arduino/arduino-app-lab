import { IconButton } from '../essential/icon-button';
import styles from './default-icon-button.module.scss';
import { EditorIconButtonProps } from './editorComponents.type';

const DefaultIconButton: React.FC<EditorIconButtonProps> = ({
  label,
  Icon,
  onPress,
  isDisabled,
  isPressed,
}: EditorIconButtonProps) => (
  <IconButton
    label={label}
    title={label}
    Icon={Icon}
    isDisabled={isDisabled}
    aria-pressed={isPressed}
    // react-aria calls onPress with a PressEvent; the contract takes no arguments.
    onPress={onPress && ((): void => onPress())}
    classes={{ button: styles['default-icon-button'] }}
  />
);

export default DefaultIconButton;
