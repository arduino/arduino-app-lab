import {
  AskIcon,
  BeResponsibleIcon,
  PrivateDataIcon,
} from '@cloud-editor-mono/images/assets/icons';
import { useContext } from 'react';

import { Button, ButtonType } from '../../../../../essential/button';
import { useI18n } from '../../../../../i18n/useI18n';
import { Small, TextSize, XSmall } from '../../../../../typography';
import { SidenavContext } from '../../../../context/sidenavContext';
import { GenAIContext } from '../../context/GenAIContext';
import { legalDisclaimerMessages } from '../../messages';
import styles from './legal-disclaimer.module.scss';

const LegalDisclaimer: React.FC = () => {
  const { formatMessage } = useI18n();
  const { acceptLegalDisclaimer } = useContext(SidenavContext);
  const { linksEnabled, openGenAIPolicyTermsDialog } = useContext(GenAIContext);

  return (
    <div className={styles['legal-disclaimer']}>
      <div className={styles['title']}>
        <Small bold>{formatMessage(legalDisclaimerMessages.title)}</Small>
        <XSmall>{formatMessage(legalDisclaimerMessages.mainContent)}</XSmall>
      </div>
      <div className={styles['content']}>
        <div className={styles['block']}>
          <AskIcon />
          <div className={styles['text']}>
            <XSmall bold>
              {formatMessage(legalDisclaimerMessages.askTitle)}
            </XSmall>
            <XSmall>{formatMessage(legalDisclaimerMessages.askContent)}</XSmall>
          </div>
        </div>
        <div className={styles['block']}>
          <PrivateDataIcon />
          <div className={styles['text']}>
            <XSmall bold>
              {formatMessage(legalDisclaimerMessages.privateDataTitle)}
            </XSmall>
            <XSmall>
              {formatMessage(legalDisclaimerMessages.privateDataContent)}
            </XSmall>
          </div>
        </div>
        <div className={styles['block']}>
          <BeResponsibleIcon />
          <div className={styles['text']}>
            <XSmall bold>
              {formatMessage(legalDisclaimerMessages.beResponsibleTitle)}
            </XSmall>
            <XSmall>
              {formatMessage(legalDisclaimerMessages.beResponsibleContent)}
            </XSmall>
          </div>
        </div>
      </div>
      <XSmall className={styles['footer']}>
        {formatMessage(legalDisclaimerMessages.policyTerms, {
          privacyPolicy: linksEnabled ? (
            <Button
              type={ButtonType.Tertiary}
              size={TextSize.XSmall}
              onClick={openGenAIPolicyTermsDialog}
            >
              {formatMessage(legalDisclaimerMessages.privacyPolicy)}
            </Button>
          ) : (
            formatMessage(legalDisclaimerMessages.privacyPolicy)
          ),
        })}
      </XSmall>
      <Button onClick={(): void => acceptLegalDisclaimer()}>
        {formatMessage(legalDisclaimerMessages.acceptTerms)}
      </Button>
    </div>
  );
};

export default LegalDisclaimer;
