import { useCodeDiffBlock } from './hooks/useCodeDiffBlock';

interface CodeDiffBlockElementProps {
  originalCode: string;
  modifiedCode: string;
  startingLine: number;
  classes?: { container: string };
}

const CodeDiffBlockElement: React.FC<CodeDiffBlockElementProps> = (
  props: CodeDiffBlockElementProps,
) => {
  const { originalCode, modifiedCode, startingLine, classes } = props;

  const ref = useCodeDiffBlock(originalCode, modifiedCode, startingLine);

  return <div ref={ref} className={classes?.container} />;
};

export default CodeDiffBlockElement;
