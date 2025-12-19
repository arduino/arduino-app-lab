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
        className={clsx(styles['actions-first'], styles['button'], {
          [styles['disable']]: !totalOccurrences,
        })}
        onClick={(): void => replaceHandler(replaceValue)}
      >
        {formatMessage(messages.replace)}
      </button>
      <button
        className={clsx(styles['actions-second'], styles['button'], {
          [styles['disable']]: !totalOccurrences,
        })}
        onClick={(): void => replaceAllHandler(replaceValue)}
      >
        {formatMessage(messages.replaceAll)}
      </button>
      <div className={styles['close']} />
    </div>
  );
};

export default ReplaceSection;
