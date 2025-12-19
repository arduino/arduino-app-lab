import { MessageDescriptor } from 'react-intl';

export interface FilterableListType<T, L extends MessageDescriptor | string> {
  name: string;
  items: FilterableListItemType<T, L>[];
}

export interface FilterableListItemType<
  T,
  L extends MessageDescriptor | string,
> {
  id: T;
  label: L;
  shortcut?: string;
  labelPrefix?: React.ReactNode;
}
