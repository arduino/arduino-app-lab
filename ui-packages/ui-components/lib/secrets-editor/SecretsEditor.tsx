import { Bin, Plus } from '@cloud-editor-mono/images/assets/icons';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button, ButtonType } from '../essential/button';
import { CopyToClipboard } from '../essential/copy-to-clipboard';
import { IconButton } from '../essential/icon-button';
import { Input } from '../essential/input';
import { useI18n } from '../i18n/useI18n';
import { Medium, Text, XSmall } from '../typography';
import { isSecretEmpty, useSecretEditor } from './hooks/useSecretsEditor';
import messages from './messages';
import styles from './secrets-editor.module.scss';
import { SecretsEditorLogic } from './secretsEditor.type';

const SECRET_PREFIX = 'SECRET_';

interface SecretsEditorProps {
  secretsEditorLogic: SecretsEditorLogic;
}

const SecretsEditor: React.FC<SecretsEditorProps> = ({
  secretsEditorLogic,
}: SecretsEditorProps) => {
  const {
    secrets: sketchSecrets,
    updateSecrets,
    openDeleteSecretDialog,
  } = secretsEditorLogic();
  const { formatMessage } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  const { secrets, duplicates, addSecret, changeSecret, deleteSecret } =
    useSecretEditor({
      sketchSecrets,
      submitSecrets: updateSecrets,
      openDeleteSecretDialog,
    });

  const [focusedSecretInput, setFocusedSecretInput] = useState<string | null>(
    null,
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Medium bold className={styles.title}>
            {formatMessage(messages.header)}
          </Medium>
          <p>
            <XSmall>{formatMessage(messages.description)}</XSmall>
          </p>
        </div>

        <div className={styles['secrets-list']}>
          {secrets &&
            secrets.map((secret) => {
              const noPrefixSecretName = secret.name.replace(SECRET_PREFIX, '');

              return (
                <div key={secret.id} className={styles.secret}>
                  <Input
                    label={formatMessage(messages.keyLabel)}
                    value={noPrefixSecretName}
                    onFocus={(): void => setFocusedSecretInput(secret.id)}
                    onBlur={(): void => setFocusedSecretInput(null)}
                    error={
                      duplicates.get(secret.id)
                        ? new Error(formatMessage(messages.duplicateError))
                        : undefined
                    }
                    className={styles['key-input']}
                    before={
                      focusedSecretInput === secret.id ||
                      !!noPrefixSecretName ? (
                        <Text bold className={styles['input-prefix']}>
                          {SECRET_PREFIX}
                        </Text>
                      ) : null
                    }
                    onChange={(value): void =>
                      changeSecret({
                        id: secret.id,
                        name: `${SECRET_PREFIX}${value}`,
                      })
                    }
                  >
                    <CopyToClipboard
                      classes={{
                        container: styles['copy-to-clipboard'],
                      }}
                      text={secret.name}
                    />
                  </Input>
                  <Input
                    sensitive
                    label={formatMessage(messages.valueLabel)}
                    value={secret.value ?? ''}
                    onChange={(value): void =>
                      changeSecret({ id: secret.id, value })
                    }
                  />
                  {(secrets.length > 1 || !isSecretEmpty(secrets[0])) && (
                    <IconButton
                      classes={{ button: styles['button-delete'] }}
                      label="Delete"
                      Icon={Bin}
                      onPress={(): void => deleteSecret(secret.id)}
                    ></IconButton>
                  )}
                </div>
              );
            })}
        </div>
        <div className={styles['sticky-wrapper']}>
          <Button
            classes={{ button: styles['button-add'] }}
            Icon={Plus}
            type={ButtonType.Secondary}
            iconPosition="left"
            onClick={(): void => {
              flushSync(() => addSecret());
              containerRef.current?.scrollTo(
                0,
                containerRef.current.scrollHeight,
              );
            }}
          >
            {formatMessage(messages.addButton)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SecretsEditor;
