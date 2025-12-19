import { useCodeBlock } from './hooks/useCodeBlock';

interface CodeBlockElementProps {
  code: string;
  language?: string;
  classes?: { container: string };
}

const CodeBlockElement: React.FC<CodeBlockElementProps> = (
  props: CodeBlockElementProps,
) => {
  const { classes, code, language } = props;

  const ref = useCodeBlock(code, language);

  return <div ref={ref} className={classes?.container} />;
};

export default CodeBlockElement;
