import { PressEvents } from '@react-types/shared';
import clsx from 'clsx';
import { memo } from 'react';

import { useI18n } from '../i18n/useI18n';
import { SidenavItemId, SidenavItemWithId } from './sidenav.type';
import SidenavItem from './SidenavItem';

interface SidenavItemsProps {
  items: SidenavItemWithId[];
  onInteract?: PressEvents['onPress'];
  isGenAiBannerDismissed: boolean;
  sketchExplorerHasBeenOpened: boolean;
  classes?: { container: string };
}

const SidenavItems: React.FC<SidenavItemsProps> = (
  props: SidenavItemsProps,
) => {
  const {
    items,
    onInteract,
    isGenAiBannerDismissed,
    sketchExplorerHasBeenOpened,
    classes,
  } = props;
  const { formatMessage } = useI18n();

  const mappedItems = items.map(function listItem(item) {
    if (!item) {
      return null;
    }
    const { id, label, Icon, active } = item;
    const formattedLabel = formatMessage(label);
    const itemDescriptorId = `item-${id}`;
    return (
      <SidenavItem
        key={id}
        id={id}
        itemDescriptorId={itemDescriptorId}
        label={label}
        formattedLabel={formattedLabel}
        onInteract={onInteract}
        active={active}
        Icon={Icon}
        isGenAiBannerDismissed={isGenAiBannerDismissed}
        sketchExplorerHasBeenOpened={sketchExplorerHasBeenOpened}
      />
    );
  });

  return (
    <ul className={clsx(classes?.container)}>
      {mappedItems.filter(
        (item) =>
          item?.key !== SidenavItemId.Libraries &&
          item?.key !== SidenavItemId.Reference &&
          item?.key !== SidenavItemId.GenAI,
      )}
      <ul id="libraries-and-reference">
        {mappedItems.filter(
          (item) =>
            item?.key === SidenavItemId.Libraries ||
            item?.key === SidenavItemId.Reference,
        )}
      </ul>
      <ul id="gen-ai">
        {mappedItems.filter((item) => item?.key === SidenavItemId.GenAI)}
      </ul>
    </ul>
  );
};

export default memo(SidenavItems);
