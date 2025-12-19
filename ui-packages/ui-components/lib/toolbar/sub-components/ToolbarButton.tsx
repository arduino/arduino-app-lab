import { WrapperTitle } from '../../essential/wrapper-title';
import { XSmall } from '../../typography';
import { SetToolbarSelection } from '../Toolbar.type';

interface ToolbarButtonProps {
  id?: string;
  onClick?: SetToolbarSelection;
  classes?: { button: string };
  label: string;
  Icon?: React.FC;
  disabled?: boolean;
  children?: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = (
  props: ToolbarButtonProps,
) => {
  const { id, onClick, classes, label, Icon, disabled, children } = props;

  const renderToolbarButton = (): JSX.Element => (
    <button
      id={id}
      onClick={onClick}
      className={classes?.button}
      disabled={disabled}
    >
      {Icon ? (
        <>
          {/* for browser compatibility?
      eslint-disable-next-line @typescript-eslint/ban-ts-comment
      @ts-ignore */}
          <Icon aria-hidden="true" focusable="false" />
          <span className="visually-hidden">{label}</span>
        </>
      ) : (
        <XSmall>{label}</XSmall>
      )}
      {children}
    </button>
  );
  return disabled ? (
    renderToolbarButton()
  ) : (
    <WrapperTitle title={label}>{renderToolbarButton()}</WrapperTitle>
  );
};

export default ToolbarButton;
