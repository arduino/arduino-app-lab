import {
  ButtonVariant,
  Input,
  InputStyle,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { Blocked, Button } from '../../../ui';
import styles from './api-key-field.module.scss';

type ApiKeyFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  verifyLabel: string;
  onVerify: () => void | Promise<void>;
  verifying?: boolean;
  disabled?: boolean;
  verifyDisabled?: boolean;
  // Shows dots instead of the key, with no toggle to reveal it.
  masked?: boolean;
  autoFocus?: boolean;
  // Hides Verify while the key is being checked, for a screen that says so above the field.
  hideVerify?: boolean;
  blockedReason?: string;
  // The field's name for a screen reader: the visible label is a span, which names nothing.
  ariaLabel?: string;
  // Rendered before Verify, for a form whose way out sits beside it.
  cancelButton?: React.ReactNode;
};

// The API key field and its Verify button, shared by every screen that takes a key.
export const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  value,
  onChange,
  label,
  placeholder,
  verifyLabel,
  onVerify,
  verifying,
  disabled,
  verifyDisabled,
  masked,
  autoFocus,
  hideVerify,
  blockedReason,
  ariaLabel,
  cancelButton,
}) => (
  <div className={styles['row']}>
    <Input
      inputStyle={InputStyle.AppLab}
      surface="below-1"
      type={masked ? 'password' : 'text'}
      autoFocus={autoFocus}
      disabled={disabled}
      value={value}
      onChange={onChange}
      onEnter={(): void => {
        void onVerify();
      }}
      placeholder={placeholder}
      label={label}
      aria-label={ariaLabel}
      className={styles['input']}
    />
    {cancelButton}
    {!hideVerify && (
      <Blocked reason={blockedReason}>
        <Button
          variant={ButtonVariant.Primary}
          loading={verifying}
          disabled={value.trim() === '' || verifyDisabled}
          onClick={(): void => {
            void onVerify();
          }}
          className={styles['verify-btn']}
        >
          {verifyLabel}
        </Button>
      </Blocked>
    )}
  </div>
);

export default ApiKeyField;
