import clsx from 'clsx';
import { ReactElement, useRef } from 'react';
import { AriaButtonProps, useButton, VisuallyHidden } from 'react-aria';

import { WrapperTitle } from '../wrapper-title';
import styles from './icon-button.module.scss';

export type IconButtonProps = Omit<AriaButtonProps, 'onClick'> & {
  label: string;
  title?: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  classes?: {
    button?: string;
    icon?: string;
    tooltip?: string;
  };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** For a button that toggles something: react-aria's button props do not
   * carry it, so it has to be forwarded explicitly. */
  'aria-pressed'?: React.AriaAttributes['aria-pressed'];
};

/**
 * The package's icon button: unstyled apart from focus and disabled states.
 * Callers give it size and colour through `classes.button`.
 */
const IconButton: React.FC<IconButtonProps> = (props: IconButtonProps) => {
  const {
    label,
    title,
    Icon,
    classes,
    children,
    isDisabled = false,
    onMouseEnter,
    onMouseLeave,
    ['aria-describedby']: ariaDescribedBy,
    ['aria-pressed']: ariaPressed,
  } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);

  const renderIconButton = (): ReactElement => (
    <button
      {...buttonProps}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(styles['icon-button'], classes?.button, {
        [styles.disabled]: isDisabled,
        [styles['has-text']]: Boolean(children),
      })}
      aria-describedby={ariaDescribedBy}
      aria-pressed={ariaPressed}
    >
      {children}
      <Icon
        aria-hidden="true"
        focusable="false"
        className={clsx(classes?.icon)}
      />
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  );

  return title ? (
    <WrapperTitle title={title} classNames={{ tooltip: classes?.tooltip }}>
      {renderIconButton()}
    </WrapperTitle>
  ) : (
    renderIconButton()
  );
};

export default IconButton;
