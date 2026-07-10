import clsx from 'clsx';
import { useRef } from 'react';
import { AriaButtonProps, useButton, VisuallyHidden } from 'react-aria';

import { WrapperTitle } from '../wrapper-title';
import styles from './icon-button.module.scss';

type IconButtonProps = AriaButtonProps & {
  label: string;
  title?: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  classes?: {
    button?: string;
    icon?: string;
    tooltip?: string;
  };
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

/**
 *This component if for cloud-editor, use `IconButton` from `components-by-app/app-lab/essential` instead.
 */
const IconButton: React.FC<IconButtonProps> = (props: IconButtonProps) => {
  const {
    label,
    title,
    Icon,
    classes,
    children,
    isDisabled = false,
    onClick,
    onMouseEnter,
    onMouseLeave,
    ['aria-describedby']: ariaDescribedBy,
  } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);

  const renderIconButton = (): JSX.Element => (
    <button
      {...buttonProps}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(styles['icon-button'], classes?.button, {
        [styles.disabled]: isDisabled,
        [styles['has-text']]: Boolean(children),
      })}
      aria-describedby={ariaDescribedBy}
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
