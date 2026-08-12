import clsx from 'clsx';

import { BasicInput } from '../../essential/input';
import { useI18n } from '../../i18n/useI18n';
import styles from '../find-and-replace.module.scss';
import { useReplace } from '../findAndReplace';
import { ReplaceSectionProps } from '../findAndReplace.type';
import { messages } from '../messages';

const ReplaceSection: React.FC<ReplaceSectionProps> = (
  props: ReplaceSectionProps,
) => {
  const { formatMessage } = useI18n();
  const { totalOccurrences, view, searchState, selectNextMatch } = props;
  const { replaceValue, setReplaceValue, replaceHandler, replaceAllHandler } =
    useReplace(view, searchState, selectNextMatch);

  const isReadOnly = view.state.readOnly;
  const isDisabled = !totalOccurrences || isReadOnly;

  return (
    <div className={styles['row']}>
      <div className={styles['replace']}>
        <BasicInput
          className={clsx(styles['input'])}
          value={replaceValue}
          onChange={setReplaceValue}
        />
      </div>
      <button
        disabled={isDisabled}
        className={clsx(styles['actions-first'], styles['button'], {
          [styles['disable']]: isDisabled,
        })}
        onClick={(): void => replaceHandler(replaceValue)}
      >
        {formatMessage(messages.replace)}
      </button>
      <button
        disabled={isDisabled}
        className={clsx(styles['actions-second'], styles['button'], {
          [styles['disable']]: isDisabled,
        })}
        onClick={(): void => replaceAllHandler(replaceValue)}
      >
        {formatMessage(messages.replaceAll)}
      </button>
    </div>
  );
};

export default ReplaceSection;
