import { ArrayElement } from '@cloud-editor-mono/common';
import { ReactElement, useCallback } from 'react';
import { useRef } from 'react';
import { AriaMenuOptions, useFilter } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { Item, Section } from 'react-stately';

import { useI18n } from '../../i18n/useI18n';
import { XXSmall } from '../../typography';
import useDebouncedSearch from '../search-field/useDebouncedSearch';
import { FilterableList } from './FilterableList';
import {
  FilterableListItemType,
  FilterableListType,
} from './filterableList.type';
interface FilterableListWrapperProps<T, L extends MessageDescriptor | string>
  extends AriaMenuOptions<FilterableListItemType<T, L>> {
  searchRef: React.ForwardedRef<HTMLDivElement>;
  searchable?: boolean;
  sections: FilterableListType<T, L>;
  filterList: (filter: string, fromFrom: unknown[]) => unknown[];
  label: string;
  classes?: {
    root?: string;
    item?: string;
    searchBar?: string;
    container?: string;
  };
}

export function FilterableListWrapper<T, L extends MessageDescriptor | string>(
  props: FilterableListWrapperProps<T, L>,
): JSX.Element {
  const { searchRef, searchable, sections, label, classes, ...rest } = props;

  const { formatMessage } = useI18n();

  const ref = useRef<HTMLUListElement>(null);

  const onListFiltered = useCallback((): void => {
    if (ref.current) ref.current.scrollTo(0, 0);
  }, []);

  const { contains } = useFilter({
    sensitivity: 'base',
  });

  const filterItems = useCallback(
    (
      items: FilterableListItemType<T, L>[],
      query: string,
    ): FilterableListItemType<T, L>[] => {
      onListFiltered && onListFiltered();

      return items.filter((item) => {
        const label =
          typeof item.label === 'string'
            ? item.label
            : formatMessage(item.label);
        return contains(label, query);
      });
    },
    [contains, formatMessage, onListFiltered],
  );

  const { query, setQuery, filteredItems } = useDebouncedSearch<
    ArrayElement<FilterableListItemType<T, L>[]>
  >(sections.items, filterItems);

  return (
    <FilterableList
      {...rest}
      searchRef={searchRef}
      label={label}
      query={query}
      setQuery={setQuery}
      searchable={searchable}
      classes={classes}
      onAction={props.onAction}
    >
      <Section key={sections.name} items={filteredItems}>
        {(item: FilterableListItemType<T, L>): ReactElement => {
          const label =
            typeof item.label === 'string'
              ? item.label
              : formatMessage(item.label);

          return (
            <Item textValue={label}>
              <XXSmall>
                {item.labelPrefix}
                {label}
              </XXSmall>
            </Item>
          );
        }}
      </Section>
    </FilterableList>
  );
}
