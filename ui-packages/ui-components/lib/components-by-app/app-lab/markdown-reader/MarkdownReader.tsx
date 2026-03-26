import clsx from 'clsx';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { PluggableList } from 'react-markdown/lib/react-markdown';
import { AllowElement } from 'react-markdown/lib/rehype-filter';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import remarkRemoveComments from 'remark-remove-comments';

import { Skeleton } from '../../../skeleton';
import styles from './markdown-reader.module.scss';
import { MarkdownReaderTagA } from './sub-components/tag-a/TagA';
import { MarkdownReaderTagBlockquote } from './sub-components/tag-blockquote/TagBlockquote';
import { MarkdownReaderTagCode } from './sub-components/tag-code/TagCode';
import { MarkdownReaderTagImg } from './sub-components/tag-img/TagImg';
import { MarkdownReaderTagPre } from './sub-components/tag-pre/TagPre';
import { MarkdownReaderTagSummary } from './sub-components/tag-summary/TagSummary';

interface MarkdownReaderProps {
  content?: string;
  allowElement?: AllowElement;
  onOpenExternalLink?: (url: string) => void;
  onOpenInternalLink?: (url: string) => void;
  onCopyCode?: () => void;
  classes?: { reader: string };
}

const MarkdownReader: React.FC<MarkdownReaderProps> = (
  props: MarkdownReaderProps,
) => {
  const {
    classes,
    content,
    allowElement,
    onOpenInternalLink,
    onOpenExternalLink,
    onCopyCode,
  } = props;

  const TagA = useMemo(
    () => MarkdownReaderTagA(onOpenExternalLink, onOpenInternalLink),
    [onOpenExternalLink, onOpenInternalLink],
  );
  const TagPre = useMemo(() => MarkdownReaderTagPre(onCopyCode), [onCopyCode]);

  return content === undefined ? (
    <div className={styles['markdown-reader-loader']}>
      <Skeleton variant="rounded" count={3} />
    </div>
  ) : (
    <ReactMarkdown
      className={clsx(styles['markdown-reader'], classes?.reader)}
      remarkPlugins={[remarkRemoveComments, remarkGfm] as PluggableList}
      rehypePlugins={[rehypeRaw, rehypeSlug] as PluggableList}
      components={{
        a: TagA,
        pre: TagPre,
        summary: MarkdownReaderTagSummary,
        code: MarkdownReaderTagCode,
        blockquote: MarkdownReaderTagBlockquote,
        img: MarkdownReaderTagImg,
      }}
      allowElement={allowElement}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownReader;
