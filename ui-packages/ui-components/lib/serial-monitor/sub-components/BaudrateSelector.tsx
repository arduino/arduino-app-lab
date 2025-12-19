import { DropdownRounded } from '../../essential/dropdown-rounded';

type BaudRateSelectorProps = {
  baudRates: number[];
  onBaudRateSelected: (baudRate: number) => void;
  selectedBaudRate: number;
  disabled: boolean;
  classes?: { wrapper?: string; menu?: string };
};

const ButtonContent: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => {
  return <>{children} baud</>;
};

const BaudRateSelector: React.FC<BaudRateSelectorProps> = (
  props: BaudRateSelectorProps,
) => {
  const { baudRates, onBaudRateSelected, selectedBaudRate, disabled, classes } =
    props;

  return (
    <DropdownRounded
      items={baudRates.map((baudRate) => ({
        value: baudRate,
        text: baudRate.toString(),
      }))}
      onChange={onBaudRateSelected}
      selectedValue={selectedBaudRate}
      ButtonContent={ButtonContent}
      disabled={disabled}
      classes={classes}
    />
  );
};

export default BaudRateSelector;
