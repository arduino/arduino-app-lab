import { DropdownRounded } from '../../essential/dropdown-rounded';
import { useI18n } from '../../i18n/useI18n';
import type { UseSelectLineEnding } from '../hooks/useSelectLineEnding';
import { messages } from '../messages';

type LineEndingSelectorProps = ReturnType<UseSelectLineEnding> & {
  disabled: boolean;
  classes?: { wrapper?: string; menu?: string };
};

const LineEndingSelector: React.FC<LineEndingSelectorProps> = (
  props: LineEndingSelectorProps,
) => {
  const {
    lineEndings,
    onLineEndingSelected,
    selectedLineEnding,
    disabled,
    classes,
  } = props;

  const { formatMessage } = useI18n();

  return (
    <DropdownRounded
      items={lineEndings.map((lineEnding) => ({
        text: formatMessage(messages[lineEnding]),
        value: lineEnding,
      }))}
      onChange={onLineEndingSelected}
      selectedValue={selectedLineEnding}
      disabled={disabled}
      classes={classes}
    />
  );
};

export default LineEndingSelector;
