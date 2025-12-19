import {
  ChevronRightNoPad,
  CloseX,
} from '@cloud-editor-mono/images/assets/icons';
import { closeSearchPanel as cmCloseSearchPanel } from '@codemirror/search';
import clsx from 'clsx';
import React, { useState } from 'react';

import { IconButton } from '../essential/icon-button';
import styles from './find-and-replace.module.scss';
import { useFindAndReplace } from './findAndReplace';
import { FindAndReplaceProps } from './findAndReplace.type';
import FindSection from './subcomponents/FindSection';
import ReplaceSection from './subcomponents/ReplaceSection';

const FindAndReplaceSection: React.FC<FindAndReplaceProps> = (
  props: FindAndReplaceProps,
) => {
  const {
    view,
    loading,
    setLoading,
    totalOccurrences,
    setTotalOccurrences,
    replaceOpen = false,
    hasHeader = false,
  } = props;

  const [isReplacing, setIsReplacing] = useState<boolean>(replaceOpen);
  const handleToggle = (): void => {
    setIsReplacing(!isReplacing);
  };

  const {
    searchState,
    setSearchState,
    currentMatch,
    selectNextMatch,
    selectPrevMatch,
  } = useFindAndReplace(view, setLoading, setTotalOccurrences);

  return (
    <section
      className={clsx(styles['container'], {
        [styles['has-header']]: hasHeader,
      })}
    >
      <div className={styles['row']}>
        <IconButton
          title={isReplacing ? 'Close replace panel' : 'Open replace panel'}
          label={isReplacing ? 'Close replace panel' : 'Open replace panel'}
          onPress={handleToggle}
          classes={{
            button: clsx(styles['toggle-replace'], {
              [styles['active']]: isReplacing,
            }),
          }}
          Icon={ChevronRightNoPad}
        />
        <FindSection
          view={view}
          loading={loading}
          currentMatch={currentMatch}
          searchState={searchState}
          setSearchState={setSearchState}
          totalOccurrences={totalOccurrences}
          selectNextMatch={selectNextMatch}
          selectPrevMatch={selectPrevMatch}
        />
        <IconButton
          title="Close"
          label="Close"
          onPress={(): boolean => cmCloseSearchPanel(view)}
          classes={{
            button: styles['close'],
          }}
          Icon={CloseX}
        />
      </div>
      {isReplacing ? (
        <ReplaceSection
          view={view}
          searchState={searchState}
          totalOccurrences={totalOccurrences}
          selectNextMatch={selectNextMatch}
        />
      ) : null}
    </section>
  );
};

export default FindAndReplaceSection;
