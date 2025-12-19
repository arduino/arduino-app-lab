import { ApplyFix, GoToError } from '@cloud-editor-mono/images/assets/icons';
import { useEffect, useRef, useState } from 'react';
import { useIntersection } from 'react-use';

import { IconButton } from '../essential/icon-button';
import { useI18n } from '../i18n/useI18n';
import { useTooltip } from '../tooltip';
import { XXSmall } from '../typography';
import styles from './code-diff-block.module.scss';
import { messages } from './messages';

interface CodeDiffSummaryProps {
  fileName: string;
  scrollToLine: () => void;
  handleGenAiApplyFixToCode: (
    fileName: string,
    code?: string,
    lineToScroll?: number,
  ) => void;
  handleApplyPatchAvailability: () => string | false;
  parentRef: React.RefObject<HTMLDivElement>;
  lineToScroll: number;
  isSending?: boolean;
}

const CodeDiffSummary: React.FC<CodeDiffSummaryProps> = (
  props: CodeDiffSummaryProps,
) => {
  const {
    fileName,
    handleGenAiApplyFixToCode,
    handleApplyPatchAvailability,
    scrollToLine,
    parentRef,
    lineToScroll,
    isSending,
  } = props;

  const [fixedCode, setFixedCode] = useState<string>();

  const summaryRef = useRef<HTMLDivElement>(null);

  const intersection = useIntersection(summaryRef, {
    root: parentRef.current,
    threshold: 1,
  });

  useEffect(() => {
    if (intersection && intersection.intersectionRatio > 0) {
      const code = handleApplyPatchAvailability() || '';
      setFixedCode(code);
    }
  }, [handleApplyPatchAvailability, intersection]);

  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.errorNotFixedInCode),
    triggerType: 'hover',
    renderDelay: 1000,
  });

  return (
    <div ref={summaryRef} className={styles['summary-node']}>
      <XXSmall className={styles['title']} title={fileName} bold>
        {fileName}
      </XXSmall>
      <div className={styles['buttons']}>
        <IconButton
          title={formatMessage(messages.goToError)}
          label={formatMessage(messages.goToError)}
          Icon={GoToError}
          onPress={scrollToLine}
        >
          <XXSmall bold>{formatMessage(messages.goToError)}</XXSmall>
        </IconButton>
        <div {...tooltipProps}>
          <IconButton
            title={formatMessage(messages.applyFix)}
            label={formatMessage(messages.applyFix)}
            Icon={ApplyFix}
            onPress={(): void => {
              handleGenAiApplyFixToCode(fileName, fixedCode, lineToScroll);
            }}
            isDisabled={!fixedCode || isSending}
          >
            <XXSmall bold>{formatMessage(messages.applyFix)}</XXSmall>
          </IconButton>
        </div>
        {!fixedCode && renderTooltip(styles['apply-tooltip'])}
      </div>
    </div>
  );
};

export default CodeDiffSummary;
