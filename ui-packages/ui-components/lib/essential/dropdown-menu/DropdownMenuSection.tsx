import type { Node } from '@react-types/shared';
import clsx from 'clsx';
import { useMenuSection, useSeparator } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { TreeState } from 'react-stately';

import styles from './dropdown-menu.module.scss';
import { DropdownMenuItemType } from './dropdownMenu.type';
import DropdownMenuItem from './DropdownMenuItem';
interface DropdownMenuSectionProps<T, L extends MessageDescriptor | string> {
  section: Node<DropdownMenuItemType<T, L>>;
  state: TreeState<DropdownMenuItemType<T, L>>;
  classes?: {
    dropdownMenuSection?: string;
    dropdownMenuSeparator?: string;
    dropdownMenuItem?: string;
    dropdownMenuItemDisabled?: string;
  };
}

function DropdownMenuSection<T, L extends MessageDescriptor | string>(
  props: React.PropsWithChildren<DropdownMenuSectionProps<T, L>>,
): JSX.Element {
  const { section, state, classes } = props;
  const { groupProps } = useMenuSection({
    heading: section.rendered,
    'aria-label': section['aria-label'],
  });

  const { separatorProps } = useSeparator({
    elementType: 'li',
  });

  return (
    <ul
      {...groupProps}
      className={clsx(
        styles['dropdown-menu-section'],
        classes?.dropdownMenuSection,
      )}
    >
      {section.key !== state.collection.getFirstKey() ? (
        <li
          {...separatorProps}
          className={clsx(
            styles['dropdown-menu-separator'],
            classes?.dropdownMenuSeparator,
          )}
        />
      ) : null}
      {[...section.childNodes].map((node) => (
        // `.childNodes to be deprecated, keep an eye on https://github.com/adobe/react-spectrum/discussions/4348`
        <DropdownMenuItem
          key={node.key}
          item={node}
          state={state}
          classes={{
            dropdownMenuItem: classes?.dropdownMenuItem,
            dropdownMenuItemDisabled: classes?.dropdownMenuItemDisabled,
          }}
        />
      ))}
    </ul>
  );
}

export default DropdownMenuSection;
