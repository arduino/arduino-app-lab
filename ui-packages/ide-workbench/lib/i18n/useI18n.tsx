import { FormatXMLElementFn } from 'intl-messageformat';
import { useContext } from 'react';
import { IntlContext, MessageDescriptor, PrimitiveType } from 'react-intl';

export type FormatMessage = (
  descriptor: MessageDescriptor,
  values?: Record<
    string,
    | PrimitiveType
    | React.ReactElement
    | React.FC<string>
    | FormatXMLElementFn<string, string>
  >,
) => string;
type UseI18n = () => {
  formatMessage: FormatMessage;
};
export const useI18n: UseI18n = () => {
  const intl = useContext(IntlContext);
  return intl
    ? intl
    : {
        formatMessage: (
          ...args: Parameters<FormatMessage>
        ): ReturnType<FormatMessage> => {
          return typeof args[0].defaultMessage == 'string'
            ? args[0].defaultMessage
            : '';
        },
      };
};
