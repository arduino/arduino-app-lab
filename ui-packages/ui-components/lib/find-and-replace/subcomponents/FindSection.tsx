import { ChevronDown, ChevronUp } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { IconButton } from '../../essential/icon-button';
import { BasicInput } from '../../essential/input';
import { useI18n } from '../../i18n/useI18n';
import styles from '../find-and-replace.module.scss';
import { FindSectionProps, SearchState } from '../findAndReplace.type';
import { FilterChips } from '../findAndReplaceSpec';
import { messages } from '../messages';
import { selectRange } from '../utils';

const FindSection: React.FC<FindSectionProps> = (props: FindSectionProps) => {
  const { formatMessage } = useI18n();

  const {
    searchState,
    setSearchState,
    view,
    loading,
    currentMatch,
    selectPrevMatch,
    selectNextMatch,
    totalOccurrences,
  } = props;

  const toggleSearchParameters = (key: keyof SearchState): void => {
    setSearchState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <section className={styles['row']}>
      <div className={styles['find']}>
        <BasicInput
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className={styles['input']}
          value={searchState.searchValue}
          onChange={(value): void => {
            setSearchState((prev) => ({
              ...prev,
              searchValue: value,
            }));
          }}
        />
        <div className={styles['find-filters']}>
          {searchState.searchValue ? (
            <span className={styles['find-filters-count']}>
              {totalOccurrences
                ? `${currentMatch} of ${totalOccurrences}`
                : loading
                ? `${currentMatch} of +99`
                : formatMessage(messages.noResults)}
            </span>
          ) : (
            ''
          )}
          {FilterChips.map((filterChip) => (
            <IconButton
              key={filterChip.id}
              title={filterChip.label}
              label={filterChip.label}
              onPress={(): void => toggleSearchParameters(filterChip.id)}
              classes={{
                button: clsx(styles['find-filter'], {
                  [styles['find-filter-active']]: searchState[filterChip.id],
                }),
              }}
              Icon={filterChip.icon}
            />
          ))}
        </div>
      </div>
      <div className={styles['actions-first']}>
        <IconButton
          title="Previous"
          label="Previous"
          onPress={selectPrevMatch}
          classes={{
            button: styles['prev'],
          }}
          Icon={ChevronUp}
        />
        <IconButton
          title="Next"
          label="Next"
          onPress={selectNextMatch}
          classes={{
            button: styles['next'],
          }}
          Icon={ChevronDown}
        />
      </div>
      <button
        className={clsx(styles['actions-second'], styles['button'], {
          [styles['disable']]: !totalOccurrences,
        })}
        onClick={(): void => selectRange(searchState, view)}
      >
        {formatMessage(messages.selectAll)}
      </button>
    </section>
  );
};

export default FindSection;
