import ArduinoTabLogo from '@cloud-editor-mono/images/public/arduino-tab-logo.svg';
import ArduinoTabLogoWhite from '@cloud-editor-mono/images/public/arduino-tab-logo-white.svg';
import { useI18n } from '@cloud-editor-mono/ui-components';
import { useContext } from 'react';
import { Helmet } from 'react-helmet-async';

import { ThemeContext } from '../../../common/providers/theme/themeContext';
import { messages } from './messages';

interface HelmetWrapperProps {
  tabTitle?: string;
}

const HelmetWrapper: React.FC<HelmetWrapperProps> = (
  props: HelmetWrapperProps,
) => {
  const { tabTitle } = props;
  const { isDarkModeOs } = useContext(ThemeContext);

  const { formatMessage } = useI18n();

  return (
    <Helmet>
      <title>
        {tabTitle
          ? `${tabTitle} — ${formatMessage(messages.titleSuffix)}`
          : formatMessage(messages.title)}
      </title>
      <link
        rel="icon"
        type="image/svg+xml"
        href={isDarkModeOs ? ArduinoTabLogoWhite : ArduinoTabLogo}
      />
    </Helmet>
  );
};

export default HelmetWrapper;
