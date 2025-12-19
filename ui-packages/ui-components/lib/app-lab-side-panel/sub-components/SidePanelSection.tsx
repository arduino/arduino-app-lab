import { SidePanelItemInterface, SidePanelSectionId } from '../sidePanel.type';
import SidePanelItem from './SidePanelItem';

interface SidePanelSectionProps {
  id: SidePanelSectionId;
  items?: SidePanelItemInterface[];
  classes?: {
    section: string;
  };
}

const SidePanelSection: React.FC<SidePanelSectionProps> = (
  props: SidePanelSectionProps,
) => {
  const { items, classes } = props;

  return (
    <div className={classes?.section}>
      {items
        ? items.map((item) => (
            <SidePanelItem
              key={item.id}
              id={item.id}
              label={item.label}
              Icon={item.Icon}
              isActive={item.active}
            />
          ))
        : null}
    </div>
  );
};

export default SidePanelSection;
