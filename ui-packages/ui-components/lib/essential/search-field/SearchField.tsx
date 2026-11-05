import {
  SearchClearX,
  SearchMagnify,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { forwardRef, useRef } from 'react';
import { AriaSearchFieldProps, VisuallyHidden } from 'react-aria';
import { useSearchField } from 'react-aria';
import { useSearchFieldState } from 'react-stately';

import { IconButton } from '../icon-button';
import { InputStyle } from '../input/input.type';
import styles from './search-field.module.scss';
import { Flavor } from './search-field.type';

type SearchFieldProps = AriaSearchFieldProps & {
  flavor?: Flavor;
  inputStyle?: InputStyle;
  // App Lab only: a border instead of the filled background.
  outlined?: boolean;
  classes?: {
    container?: string;
    input?: string;
  };
};

const SearchField = forwardRef(
  (props: SearchFieldProps, searchRef: React.ForwardedRef<HTMLDivElement>) => {
    const {
      classes,
      label,
      flavor = Flavor.Square,
      inputStyle = InputStyle.CloudEditor,
      outlined = false,
    } = props;
    const isAppLab = inputStyle === InputStyle.AppLab;
    const state = useSearchFieldState(props);
    const inputRef = useRef(null);
    const { labelProps, inputProps, clearButtonProps } = useSearchField(
      props,
      state,
      inputRef,
    );
    // react-aria owns Enter (runs onSubmit) and Escape (clears). Escape is only
    // forwarded when there is something to clear, so it can bubble otherwise.
    const { onKeyDown } = inputProps;
    inputProps.onKeyDown = (e): void => {
      if (
        e.key === 'Enter' ||
        (e.key === 'Escape' && inputProps.value !== '')
      ) {
        onKeyDown?.(e);
      }
    };

    return (
      <div
        ref={searchRef}
        className={clsx(styles['input-container'], classes?.container, {
          [styles.rounded]: !isAppLab && flavor === Flavor.Rounded,
          [styles['app-lab']]: isAppLab,
          [styles.outlined]: isAppLab && outlined,
        })}
      >
        <VisuallyHidden>
          <label {...labelProps}>{label}</label>
        </VisuallyHidden>
        <SearchMagnify className={styles['search-icon']} aria-hidden="true" />
        <input
          {...inputProps}
          autoCorrect="off"
          className={clsx(styles.input, classes?.input)}
          ref={inputRef}
        />
        {state.value === '' ? null : (
          <IconButton
            label="Clear search"
            Icon={SearchClearX}
            classes={{ button: styles['clear-icon'] }}
            {...clearButtonProps}
          />
        )}
      </div>
    );
  },
);

SearchField.displayName = 'SearchField';
export default SearchField;
