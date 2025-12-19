import { Checkbox, Close } from '@cloud-editor-mono/images/assets/icons';
import { MouseEventHandler, useRef } from 'react';
import type { AriaListBoxProps } from 'react-aria';
import {
  mergeProps,
  useFocusRing,
  useListBox,
  useListBoxSection,
  useOption,
} from 'react-aria';
import type { ListState, Node } from 'react-stately';
import { useListState } from 'react-stately';

import { XXSmall } from '../../typography';
import styles from './list-box.module.scss';

type OptionProps<T> = {
  item: Node<T>;
  state: ListState<T>;
};
function Option<T>(props: OptionProps<T>): JSX.Element {
  const { item, state } = props;
  const ref = useRef<HTMLLIElement>(null);
  const { optionProps, isSelected } = useOption({ key: item.key }, state, ref);

  return (
    <li {...optionProps} ref={ref} className={styles['option']}>
      {isSelected ? <Checkbox /> : <span className={styles['checkbox']} />}
      <XXSmall>{item.rendered}</XXSmall>
    </li>
  );
}

type SectionProps<T> = {
  section: Node<T>;
  state: ListState<T>;
  onClearSelection: MouseEventHandler<SVGSVGElement>;
};
function ListBoxSection<T>(props: SectionProps<T>): JSX.Element {
  const { section, state, onClearSelection } = props;
  const { itemProps, headingProps, groupProps } = useListBoxSection({
    heading: section.rendered,
    'aria-label': section['aria-label'],
  });
  const { focusProps } = useFocusRing({
    within: true,
    autoFocus: true,
  });

  // If the section is not the first, add a separator element to provide visual separation.
  // The heading is rendered inside an <li> element, which contains
  // a <ul> with the child items.
  return (
    <>
      {section.key !== state.collection.getFirstKey() && (
        <li role="presentation" className={styles['separator']} />
      )}
      <li {...itemProps}>
        {section.rendered && (
          <span {...headingProps} className={styles['heading']}>
            <XXSmall>{section.rendered}</XXSmall>
            <Close onClick={onClearSelection} />
          </span>
        )}
        <ul {...mergeProps(groupProps, focusProps)}>
          {Array.from(state.collection.getChildren?.(section.key) ?? []).map(
            (node) => (
              <Option key={node.key} item={node} state={state} />
            ),
          )}
        </ul>
      </li>
    </>
  );
}

export function ListBox<T extends object>(
  props: AriaListBoxProps<T> & {
    onClearSelection: MouseEventHandler<SVGSVGElement>;
  },
): JSX.Element {
  // Create state based on the incoming props
  const state = useListState(props);

  // Get props for the listbox element
  const ref = useRef<HTMLUListElement>(null);
  const { listBoxProps } = useListBox(props, state, ref);

  return (
    <ul {...listBoxProps} ref={ref} className={styles['list-box']}>
      {[...state.collection].map((item) =>
        item.type === 'section' ? (
          <ListBoxSection
            key={item.key}
            section={item}
            state={state}
            onClearSelection={props.onClearSelection}
          />
        ) : (
          <Option key={item.key} item={item} state={state} />
        ),
      )}
    </ul>
  );
}
