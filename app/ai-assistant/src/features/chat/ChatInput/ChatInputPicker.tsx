import { Checkmark, ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import { useTooltip } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import styles from './chat-input.module.scss';

interface PickerItem {
  id: string;
  name: string;
  description?: string;
}

interface PickerOptionProps {
  item: PickerItem;
  label: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

interface ChatInputPickerProps {
  items: PickerItem[];
  selected: PickerItem;
  label: string;
  isOpen: boolean;
  // The model picker appends the resolved version to the name.
  getLabel?: (item: PickerItem) => string;
  onToggle: () => void;
  onSelect: (id: string) => void;
}

const TOOLTIP_PARAMS = { timeout: 0, renderDelay: 500 };

const PickerOption: React.FC<PickerOptionProps> = ({
  item,
  label,
  isSelected,
  onSelect,
}: PickerOptionProps) => {
  const { props: tooltipProps, renderTooltip } = useTooltip({
    ...TOOLTIP_PARAMS,
    content: item.description,
  });

  return (
    <li role="option" aria-selected={isSelected}>
      <div
        {...tooltipProps}
        className={styles['chat-input-picker-option-wrapper']}
      >
        <button
          type="button"
          className={styles['chat-input-picker-option']}
          data-selected={isSelected}
          onClick={(): void => onSelect(item.id)}
        >
          {label}
          {isSelected && (
            <Checkmark
              className={styles['chat-input-picker-check']}
              aria-hidden="true"
            />
          )}
        </button>
        {item.description && renderTooltip(styles['chat-input-picker-tooltip'])}
      </div>
    </li>
  );
};

export const ChatInputPicker: React.FC<ChatInputPickerProps> = ({
  items,
  selected,
  label,
  isOpen,
  getLabel = (item: PickerItem): string => item.name,
  onToggle,
  onSelect,
}: ChatInputPickerProps) => {
  const {
    props: tooltipProps,
    renderTooltip,
    setShowTooltip,
  } = useTooltip({
    ...TOOLTIP_PARAMS,
    content: selected.description,
  });

  return (
    <div className={styles['chat-input-picker']}>
      <div
        {...tooltipProps}
        className={styles['chat-input-picker-trigger-wrapper']}
      >
        <button
          type="button"
          className={styles['chat-input-picker-trigger']}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={(): void => {
            // Don't leave the hint hanging over the menu that's about to open.
            setShowTooltip(false);
            onToggle();
          }}
        >
          <span className={styles['chat-input-picker-value']}>
            {getLabel(selected)}
          </span>
          <ChevronDown
            className={styles['chat-input-picker-icon']}
            aria-hidden="true"
          />
        </button>
        {selected.description &&
          renderTooltip(styles['chat-input-picker-tooltip'])}
      </div>

      {isOpen && (
        <ul className={styles['chat-input-picker-menu']} role="listbox">
          {items.map((item) => (
            <PickerOption
              key={item.id}
              item={item}
              label={getLabel(item)}
              isSelected={item.id === selected.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
