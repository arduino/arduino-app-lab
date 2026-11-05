import {
  CopySelection,
  IconNavigationArrowCaretNormalDown,
  IconNavigationArrowCaretNormalRight,
} from '@cloud-editor-mono/images/assets/icons';
import { useState } from 'react';
import { FormattedMessage } from 'react-intl';

import { HUGGING_FACE_ORIGIN } from '../../../../../components-by-app/app-lab/ai-model/helpers';
import { useI18n } from '../../../../../i18n/useI18n';
import { XXSmall } from '../../../../../typography';
import { addHuggingFaceModelDialogMessages as messages } from '../../../messages';
import styles from './model-id-help.module.scss';

const HUGGING_FACE_MODELS_URL = `${HUGGING_FACE_ORIGIN}/models`;
const EXAMPLE_MODEL_OWNER = 'unsloth';
const EXAMPLE_MODEL_NAME = 'Qwen3.5-2B-GGUF';

type ModelIdHelpProps = {
  onOpenExternal: (url: string) => void;
};

export const ModelIdHelp: React.FC<ModelIdHelpProps> = ({
  onOpenExternal,
}: ModelIdHelpProps) => {
  const { formatMessage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles['model-id-help']}>
      <button
        type="button"
        className={styles['model-id-help-toggle']}
        aria-expanded={isOpen}
        onClick={(): void => setIsOpen((wasOpen) => !wasOpen)}
      >
        {isOpen ? (
          <IconNavigationArrowCaretNormalDown
            className={styles['model-id-help-caret']}
          />
        ) : (
          <IconNavigationArrowCaretNormalRight
            className={styles['model-id-help-caret']}
          />
        )}
        <XXSmall bold>{formatMessage(messages.modelIdHelpToggle)}</XXSmall>
      </button>

      {isOpen && (
        <div className={styles['model-id-help-content']}>
          <div className={styles['model-id-help-steps']}>
            <ol className={styles['model-id-help-list']}>
              <li>
                <XXSmall>
                  <FormattedMessage
                    {...messages.modelIdHelpOpenModel}
                    values={{
                      link: (chunks) => (
                        <a
                          href={HUGGING_FACE_MODELS_URL}
                          onClick={(e): void => {
                            e.preventDefault();
                            onOpenExternal(HUGGING_FACE_MODELS_URL);
                          }}
                          className={styles['model-id-help-link']}
                        >
                          {chunks}
                        </a>
                      ),
                    }}
                  />
                </XXSmall>
              </li>
              <li>
                <XXSmall>{formatMessage(messages.modelIdHelpCopyId)}</XXSmall>
              </li>
            </ol>

            <div className={styles['model-id-help-example']} aria-hidden>
              <span>
                <XXSmall
                  monospace
                  className={styles['model-id-help-example-owner']}
                >
                  {`${EXAMPLE_MODEL_OWNER}/`}
                </XXSmall>
                <XXSmall monospace>{EXAMPLE_MODEL_NAME}</XXSmall>
              </span>
              <CopySelection className={styles['model-id-help-example-icon']} />
              <XXSmall className={styles['model-id-help-example-pointer']}>
                {formatMessage(messages.modelIdHelpCopyPointer)}
              </XXSmall>
            </div>
          </div>

          <XXSmall>{formatMessage(messages.modelIdHelpUrl)}</XXSmall>
        </div>
      )}
    </div>
  );
};
