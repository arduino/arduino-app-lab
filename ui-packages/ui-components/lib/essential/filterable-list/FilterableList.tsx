import clsx from 'clsx';
import { ReactElement } from 'react';
import { useRef } from 'react';
import { AriaMenuOptions, useMenu } from 'react-aria';
import { MessageDescriptor } from 'react-intl';
import { useTreeState } from 'react-stately';

import {
  Flavor as SearchFlavor,
  SearchField,
} from '../../essential/search-field';
import { DropdownMenuSection } from '../dropdown-menu';
import styles from './filterable-list.module.scss';
import { FilterableListItemType } from './filterableList.type';

interface FilterableListProps<T, L extends MessageDescriptor | string>
  extends AriaMenuOptions<FilterableListItemType<T, L>> {
  searchRef: React.ForwardedRef<HTMLDivElement>;
  searchable?: boolean;
  children: ReactElement | ReactElement[];
  label: string;
  query: string;
  setQuery: (query: string) => void;
  classes?: {
    searchBar?: string;
    container?: string;
    list?: string;
    item?: string;
  };
}

export function FilterableList<T, L extends MessageDescriptor | string>(
  props: FilterableListProps<T, L>,
): JSX.Element {
  const { searchRef, searchable, label, query, setQuery, classes, ...rest } =
    props;

  const state = useTreeState<FilterableListItemType<T, L>>(rest);

  const ref = useRef<HTMLUListElement>(null);
  const { menuProps } = useMenu(rest, state, ref);

  const renderSearchField = (): JSX.Element => (
    <SearchField
      ref={searchRef}
      placeholder={label}
      label={label}
      value={query}
      onChange={setQuery}
      flavor={SearchFlavor.Square}
      classes={{
        input: styles['input'],
      }}
    />
  );

  return (
    <div className={clsx(styles['container'], classes?.container)}>
      {searchable ? renderSearchField() : null}
      <ul
        {...menuProps}
        ref={ref}
        className={clsx(styles['list'], classes?.list)}
      >
        {[...state.collection].map((item) => (
          <DropdownMenuSection
            key={item.key}
            section={item}
            state={state}
            classes={{
              dropdownMenuItem: clsx(styles['item'], classes?.item),
            }}
          />
        ))}
      </ul>
    </div>
  );
}
