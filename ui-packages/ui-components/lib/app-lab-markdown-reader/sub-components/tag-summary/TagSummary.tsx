import {
  ChevronDown,
  ChevronRightNoPad,
} from '@cloud-editor-mono/images/assets/icons';
import { ReactElement, useState } from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

export const MarkdownReaderTagSummary = ({
  children,
  node,
}: ReactMarkdownProps): ReactElement => {
  const [open, setOpen] = useState(false);

  const toggleOpen = (): void => {
    setOpen((prev) => !prev);
  };

  return (
    <summary {...node.properties} onClick={toggleOpen}>
      {open ? <ChevronDown /> : <ChevronRightNoPad />}
      <span>{children}</span>
    </summary>
  );
};
