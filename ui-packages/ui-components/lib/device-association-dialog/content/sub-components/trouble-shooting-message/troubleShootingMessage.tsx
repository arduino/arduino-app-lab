import { MessageDescriptor } from 'react-intl';

import { useI18n } from '../../../../i18n/useI18n';
import { Link, Text, TextSize } from '../../../../typography';
import { messages } from '../../messages';

interface TroubleShootingMessageProps {
  messageDescriptor?: MessageDescriptor;
  troubleShootingUrl: string;
  bigger?: boolean;
  classes?: { span?: string };
}

const TroubleShootingMessage: React.FC<TroubleShootingMessageProps> = (
  props: TroubleShootingMessageProps,
) => {
  const {
    messageDescriptor = messages.troubleshootingMessage,
    troubleShootingUrl,
    classes,
    bigger = false,
  } = props;
  const { formatMessage } = useI18n();

  const troubleshootingLink = (
    <Link
      href={troubleShootingUrl}
      target="_blank"
      rel="noreferrer"
      disabled={!troubleShootingUrl}
    >
      {formatMessage(messages.troubleshootingLink)}
    </Link>
  );

  return (
    <Text
      className={classes?.span}
      size={bigger ? TextSize.XSmall : TextSize.XXSmall}
    >
      {formatMessage(messageDescriptor, { troubleshootingLink })}
    </Text>
  );
};

export default TroubleShootingMessage;
