import { NoResults as NoResultsIcon } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { MessageDescriptor } from 'react-intl';

import { useI18n } from '../../../i18n/useI18n';
import { Small, XXSmall } from '../../../typography';
import { messages } from '../../messages';
import styles from './no-results.module.scss';

interface NoResultsProps {
  resourceName?: string;
  title?: MessageDescriptor;
  message?: MessageDescriptor;
  classes?: { container?: string; image?: string };
}

const NoResults: React.FC<NoResultsProps> = (props: NoResultsProps) => {
  const { resourceName = 'item', title, message, classes } = props;
  const { formatMessage } = useI18n();

  return (
    <div className={clsx(styles['no-results'], classes?.container)}>
      <NoResultsIcon
        className={clsx(styles['ex-no-results-image'], classes?.image)}
      />
      <Small bold>
        {title ? formatMessage(title) : formatMessage(messages.noResults)}
      </Small>
      <XXSmall className={clsx(styles.subtitle)}>
        {message
          ? formatMessage(message)
          : formatMessage(messages.noResultsSubtitle, { resourceName })}
      </XXSmall>
    </div>
  );
};

NoResults.displayName = 'NoResults';
export default NoResults;
