import { Checkmark, FileCopy } from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';

import styles from './copy-field.module.scss';

type CopyFieldProps = {
  value: string;
  label?: string;
  copyLabel: string;
};

// A read-only value shaped like a text field, with a button that copies it.
export const CopyField: React.FC<CopyFieldProps> = ({
  value,
  label,
  copyLabel,
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // the value stays on screen to type by hand
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles['field']}>
      <div className={styles['body']}>
        {label && <span className={styles['label']}>{label}</span>}
        <span className={styles['value']}>{value}</span>
      </div>
      <button
        type="button"
        className={styles['copy']}
        aria-label={copyLabel}
        onClick={(): void => {
          void copy();
        }}
      >
        {copied ? (
          <Checkmark aria-hidden="true" />
        ) : (
          <FileCopy aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default CopyField;
