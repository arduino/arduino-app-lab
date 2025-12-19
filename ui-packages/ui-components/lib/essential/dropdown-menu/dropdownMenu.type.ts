import { MessageDescriptor } from 'react-intl';
export interface DropdownMenuSectionType<
  T,
  L extends MessageDescriptor | string,
> {
  name: string;
  items: DropdownMenuItemType<T, L>[];
}

export interface DropdownMenuItemType<T, L extends MessageDescriptor | string> {
  id: T;
  label: L;
  value?: string;
  shortcut?: string;
  labelPrefix?: React.ReactNode;
  labelSuffix?: React.ReactNode;
  itemClassName?: string;
  node?: JSX.Element;
}
