import clsx from 'clsx';
import { memo } from 'react';

import { UseCodeEditorParams } from '../code-mirror/codeMirror.type';
import {
  useCodeMirrorInstanceCleanup,
  useCodeMirrorStateCleanup,
} from '../code-mirror/codeMirrorViewInstances';
import { useCodeEditor } from './hooks/useCodeEditor';

type CodeEditorElementProps = {
  valueInstanceIds: string[];
  classes?: { container: string };
  hasHeader?: boolean;
} & UseCodeEditorParams;

const CodeEditorElement: React.FC<CodeEditorElementProps> = (
  props: CodeEditorElementProps,
) => {
  const { classes, valueInstanceIds, ...useCodeEditorParams } = props;
  const ref = useCodeEditor(useCodeEditorParams);

  useCodeMirrorInstanceCleanup(useCodeEditorParams.viewInstanceId);

  useCodeMirrorStateCleanup(
    useCodeEditorParams.viewInstanceId,
    valueInstanceIds,
  );

  return <div className={clsx(classes?.container)} ref={ref}></div>;
};

export default memo(CodeEditorElement);
