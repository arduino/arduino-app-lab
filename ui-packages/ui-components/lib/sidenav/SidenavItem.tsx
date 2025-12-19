import { PressEvents } from '@react-types/shared';
import { useSearch } from '@tanstack/react-location';
import clsx from 'clsx';
import { useRef } from 'react';
import { useButton, useFocusRing } from 'react-aria';
import { MessageDescriptor } from 'react-intl';

import { WrapperTitle } from '../essential/wrapper-title';
import { Link, Small } from '../typography';
import styles from './sidenav.module.scss';
import { SidenavItemId } from './sidenav.type';
import { updateSearch } from './utils';

interface SidenavItemProps {
  id: string;
  itemDescriptorId: string;
  label: MessageDescriptor;
  formattedLabel: string;
  onInteract?: PressEvents['onPress'];
  active?: boolean;
  Icon?: React.FC<{ focusable: string }>;
  isGenAiBannerDismissed: boolean;
  sketchExplorerHasBeenOpened: boolean;
}

const SidenavItem: React.FC<SidenavItemProps> = (props: SidenavItemProps) => {
  const {
    id,
    itemDescriptorId,
    formattedLabel,
    onInteract,
    active,
    Icon,
    isGenAiBannerDismissed,
    sketchExplorerHasBeenOpened,
  } = props;
  const search = useSearch();

  const { isFocusVisible, focusProps } = useFocusRing();

  const ref = useRef<HTMLLinkElement>(null);
  const { buttonProps } = useButton(
    {
      onPress: onInteract,
    },
    ref,
  );

  return (
    <li key={id} id={id} aria-describedby={itemDescriptorId}>
      <WrapperTitle title={formattedLabel}>
        <div
          className={clsx(styles['sidenav-item'], {
            [styles['active']]: active,
            [styles['focus-visible']]: isFocusVisible,
          })}
        >
          <Link
            {...buttonProps}
            {...focusProps}
            to="."
            search={updateSearch(search, { nav: !active ? id : undefined })}
            className={styles['sidenav-item-icon']}
          >
            {Icon && <Icon aria-hidden="true" focusable="false" />}
          </Link>
          <span className="visually-hidden" id={`#${itemDescriptorId}`}>
            {formattedLabel}
          </span>
        </div>
        {(id === SidenavItemId.GenAI && !isGenAiBannerDismissed) ||
        (id === SidenavItemId.Files && !sketchExplorerHasBeenOpened) ? (
          <Small uppercase className={styles['sidenav-gen-ai-badge']}>
            {'New'}
          </Small>
        ) : null}
      </WrapperTitle>
    </li>
  );
};

export default SidenavItem;
