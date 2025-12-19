import {
  Close,
  NoResults,
  SelectArrow,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import {
  MouseEventHandler,
  RefCallback,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AriaSelectProps, useFilter } from 'react-aria';
import { Item, Section, Selection, useMenuTriggerState } from 'react-stately';
import { TruncatedList } from 'react-truncate-list';

import { XSmall, XXSmall } from '../../typography';
import { highlightText } from '../../utils';
import DropdownMenuPopover from '../dropdown-menu/DropdownMenuPopover';
import { ListBox } from '../list-box/ListBox';
import useDebouncedSearch from '../search-field/useDebouncedSearch';
import styles from './multi-select.module.scss';

const PILL_MAX_LENGTH = 20;

type MultiSelectProps = {
  items: string[];
  placeholder: string;
  ariaLabel: string;
  allItemsLabel?: string;
  onSelect?: (selectedItems: string[]) => void;
};

type Props = Omit<AriaSelectProps<string> & MultiSelectProps, 'children'>;

const MultiSelect: React.FC<Props> = (props: Props) => {
  const {
    placeholder,
    items,
    ariaLabel,
    allItemsLabel = 'All items',
    onSelect = () => {},
  } = props;

  const state = useMenuTriggerState({
    ...props,
  });

  const { contains, startsWith } = useFilter({
    sensitivity: 'base',
  });

  const search = useCallback(
    (items: string[], query: string): string[] =>
      items.filter((item) => contains(item, query)),
    [contains],
  );
  const { query, setQuery, filteredItems } = useDebouncedSearch(
    items,
    search,
    250,
  );
  const [selectedList, setSelectedList] = useState<React.Key[]>([]);
  const filteredAndUnselectedList = useMemo(
    () =>
      filteredItems.filter(
        (item) => !selectedList.some((selection) => item === selection),
      ),
    [filteredItems, selectedList],
  );
  const [showPills, setShowPills] = useState(true);

  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useCallback<RefCallback<HTMLInputElement>>(
    (input) => {
      if (state.isOpen) {
        input?.focus();
        setQuery('');
      }
    },
    [setQuery, state.isOpen],
  );

  // When the open/close arrow is clicked, state.isOpen is always false
  // because the menu was previously closed by react-aria. So we track it here.
  const trackOpen = useRef<boolean>(false);

  const openDropdown = useCallback(() => {
    state.open();
    setShowPills(false);
    trackOpen.current = true;
  }, [state]);

  const closeDropdown = useCallback(() => {
    setShowPills(true);
    state.close();
    trackOpen.current = false;
  }, [state]);

  const onArrowClick = useCallback<MouseEventHandler<SVGSVGElement>>(
    (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      trackOpen.current ? closeDropdown() : openDropdown();
    },
    [closeDropdown, openDropdown],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [setQuery],
  );

  const onInputBlur = useCallback(() => {
    setShowPills(true);
  }, []);

  const clearSelection = useCallback<MouseEventHandler<SVGSVGElement>>(() => {
    setSelectedList([]);
    openDropdown();
    onSelect([]);
  }, [onSelect, openDropdown]);

  const onSelectionChange = useCallback(
    (keys: Selection) => {
      const keysList = Array.from(keys);
      setSelectedList(keysList);
      setShowPills(true);
      onSelect(keysList.map((key) => key.toString()));
    },
    [onSelect],
  );

  const sections = useMemo(
    () =>
      [
        selectedList.length > 0 ? (
          <Section title="Your Selection" key={0}>
            {selectedList.map((selection) => (
              <Item key={selection} textValue={selection.toString()}>
                {highlightText(selection.toString(), query, startsWith)}
              </Item>
            ))}
          </Section>
        ) : null,
        filteredAndUnselectedList.length > 0 ? (
          <Section key={1}>
            {filteredAndUnselectedList.map((item) => (
              <Item key={item} textValue={item.toString()}>
                {highlightText(item.toString(), query, startsWith)}
              </Item>
            ))}
          </Section>
        ) : null,
      ].filter(Boolean) as JSX.Element[],
    [selectedList, filteredAndUnselectedList, query, startsWith],
  );

  return (
    <div
      className={clsx(
        styles['multi-select-trigger'],
        state.isOpen && styles['dropdown-is-open'],
      )}
      onClick={openDropdown}
      onKeyDown={openDropdown}
      ref={triggerRef}
      role="button"
      tabIndex={0}
    >
      {showPills ? (
        selectedList.length > 0 ? (
          <>
            <TruncatedList
              renderTruncator={({ hiddenItemsCount }): JSX.Element => (
                <XXSmall key={hiddenItemsCount} className={styles['selection']}>
                  +{hiddenItemsCount}
                </XXSmall>
              )}
            >
              {selectedList
                .map((selection) => {
                  const text = selection.toString();
                  return text.length >= PILL_MAX_LENGTH
                    ? text.substring(0, PILL_MAX_LENGTH - 3) + '...'
                    : text;
                })
                .map((selection) => (
                  <XXSmall key={selection} className={styles['selection']}>
                    {selection}
                  </XXSmall>
                ))}
            </TruncatedList>
            <div className={styles['clear-pills']}>
              <Close onClick={clearSelection} />
            </div>
          </>
        ) : (
          <XXSmall className={styles['all-items']}>{allItemsLabel}</XXSmall>
        )
      ) : (
        <input
          placeholder={placeholder}
          ref={inputRef}
          value={query}
          onChange={onInputChange}
          onBlur={onInputBlur}
          className={clsx(state.isOpen && styles['dropdown-is-open'])}
        />
      )}
      <div className={styles['arrow']}>
        <SelectArrow onClick={onArrowClick} />
      </div>
      {state.isOpen && (
        <DropdownMenuPopover
          state={state}
          triggerRef={triggerRef}
          placement="bottom"
          containerPadding={-2} // For the borders
        >
          <ListBox
            aria-label={ariaLabel}
            selectionMode="multiple"
            selectedKeys={new Set(selectedList)}
            onSelectionChange={onSelectionChange}
            onClearSelection={clearSelection}
          >
            {sections}
          </ListBox>
          {filteredAndUnselectedList.length === 0 && (
            <>
              {selectedList.length > 0 && (
                <div role="presentation" className={styles['separator']} />
              )}
              <div className={styles['no-results']}>
                <NoResults />
                <XSmall>No results found</XSmall>
              </div>
            </>
          )}
        </DropdownMenuPopover>
      )}
    </div>
  );
};

MultiSelect.displayName = 'MultiSelect';

export default MultiSelect;
