import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import { useTooltip } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import {
  type PickerOptionContent,
  type PickerSubmenuAnchor,
  Picker,
  pickerStyles,
} from '../../../ui';
import styles from './chat-input.module.scss';

interface PickerItem {
  id: string;
  name: string;
  description?: string;
  hint?: string;
  icon?: string;
  // Sets this item apart from the ones listed after it
  dividerAfter?: boolean;
  groupLabel?: string;
  submenu?: boolean;
  expanded?: boolean;
}

interface ChatInputPickerProps {
  items: PickerItem[];
  selected: PickerItem;
  label: string;
  isOpen: boolean;
  // The model picker appends the resolved version to the name.
  getLabel?: (item: PickerItem) => string;
  // Marks a row other than the selected item too, such as the one whose second level holds it.
  isSelected?: (item: PickerItem) => boolean;
  // Keeps the trigger in place without opening the menu, while there is nothing to pick from yet.
  disabled?: boolean;
  // Which edge the menu is pinned to: one at the left edge has to open the other way, or it extends past the panel, whose overflow then clips it.
  align?: 'left' | 'right';
  // Which way the menu opens. Defaults to 'up': the trigger normally sits right above the composer, pinned to the
  // panel's bottom edge, so there is no room below it to open into.
  direction?: 'up' | 'down';
  onToggle: VoidFunction;
  onClose: VoidFunction;
  onSelect: (id: string) => void;
  classes?: { trigger?: string; value?: string; icon?: string; menu?: string };
  renderSubmenu?: (anchor: PickerSubmenuAnchor) => React.ReactNode;
}

export const ChatInputPicker: React.FC<ChatInputPickerProps> = ({
  items,
  selected,
  label,
  isOpen,
  getLabel = (item: PickerItem): string => item.name,
  isSelected = (item: PickerItem): boolean => item.id === selected.id,
  disabled = false,
  align = 'right',
  direction = 'up',
  onToggle,
  onClose,
  onSelect,
  classes,
  renderSubmenu,
}: ChatInputPickerProps) => {
  const {
    props: tooltipProps,
    renderTooltip,
    setShowTooltip,
  } = useTooltip({
    content: selected.description,
  });

  return (
    <Picker
      items={items}
      isOpen={isOpen}
      isSelected={isSelected}
      onSelect={onSelect}
      onClose={onClose}
      getOption={(item): PickerOptionContent => ({
        label: getLabel(item),
        Icon: item.icon,
        description: item.description,
        hint: item.hint,
        dividerAfter: item.dividerAfter,
        groupLabel: item.groupLabel,
        submenu: item.submenu,
        expanded: item.expanded,
      })}
      renderSubmenu={renderSubmenu}
      align={align}
      direction={direction}
      classes={{
        container: styles['chat-input-picker'],
        menu: clsx(styles['chat-input-picker-menu'], classes?.menu),
      }}
      renderTrigger={(): React.ReactNode => (
        <div
          {...tooltipProps}
          className={styles['chat-input-picker-trigger-wrapper']}
        >
          <button
            type="button"
            className={clsx(
              styles['chat-input-picker-trigger'],
              pickerStyles['picker-trigger-border'],
              classes?.trigger,
            )}
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            disabled={disabled}
            onClick={(): void => {
              // Don't leave the hint hanging over the menu that's about to open.
              setShowTooltip(false);
              onToggle();
            }}
          >
            {selected.icon && (
              <span
                className={styles['chat-input-picker-trigger-glyph']}
                aria-hidden="true"
              >
                {selected.icon}
              </span>
            )}
            <span
              className={clsx(
                styles['chat-input-picker-value'],
                classes?.value,
              )}
            >
              {getLabel(selected)}
            </span>
            <ChevronDown
              className={clsx(styles['chat-input-picker-icon'], classes?.icon)}
              aria-hidden="true"
            />
          </button>
          {selected.description &&
            renderTooltip(styles['chat-input-picker-tooltip'])}
        </div>
      )}
    />
  );
};
