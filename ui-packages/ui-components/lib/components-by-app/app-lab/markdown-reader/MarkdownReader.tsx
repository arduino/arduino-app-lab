import clsx from 'clsx';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { PluggableList } from 'react-markdown/lib/react-markdown';
import { AllowElement } from 'react-markdown/lib/rehype-filter';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
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

// The reader renders documents we do not control - app READMEs and Learn
// resources - and `rehypeRaw` turns their raw HTML into real elements, so the
// tree has to be sanitized before it reaches React. The GitHub schema already
// keeps everything markdown itself produces (tables, task lists, footnotes,
// `language-*` on code, `<details>`/`<summary>`); authored docs also style
// blocks with plain classes, which CSS modules keep away from our own styles.
export const sanitizeSchema = {
  ...defaultSchema,

  // Leave ids as authored. The default schema prefixes every id and id
  // reference with `user-content-` to blunt DOM clobbering, but it only
  // rewrites the targets: `href="#…"` is untouched, so each in-page link ends
  // up pointing at an id that no longer exists. GFM footnotes are worse - they
  // arrive with `user-content-` already applied by remark-gfm, so the ids get
  // it twice while their hrefs keep one. Nor can the prefix be applied
  // consistently from in here: a Learn deep link carries the authored id in the
  // URL hash, and the URL is not ours to rewrite.
  clobberPrefix: '',

  // Elements authored docs use that markdown has no syntax for. All of them are
  // inert - containers, text semantics, and media that cannot run script.
  // Notably absent is inline `<svg>`, which needs an allow-list of its own
  // (`<script>`, `<foreignObject>`, `xlink:href="javascript:"`, animation
  // events) that this schema has no notion of.
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'abbr',
    'audio',
    'caption',
    'center',
    'col',
    'colgroup',
    'figcaption',
    'figure',
    'font',
    'mark',
    'small',
    'time',
    'track',
    'u',
    'video',
    'wbr',
  ],

  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className'],
    img: [...(defaultSchema.attributes?.img ?? []), 'srcSet'],
    source: [
      ...(defaultSchema.attributes?.source ?? []),
      'src',
      'srcSet',
      'type',
    ],
    audio: ['controls', 'loop', 'muted', 'preload', 'src'],
    video: [
      'controls',
      'loop',
      'muted',
      'playsInline',
      'poster',
      'preload',
      'src',
    ],
    track: ['default', 'kind', 'label', 'src', 'srcLang'],
  },

  // Inline images are how a self-contained README embeds a diagram. A `data:`
  // URI cannot run script from `src` - images and media load with scripting
  // disabled - and `href` deliberately keeps the stricter list.
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'data'],
    poster: ['http', 'https', 'data'],
  },

  ancestors: {
    ...defaultSchema.ancestors,
    caption: ['table'],
    col: ['colgroup', 'table'],
    colgroup: ['table'],
    figcaption: ['figure'],
    track: ['audio', 'video'],
  },

  // A disallowed element is unwrapped, not deleted, so its children survive it.
  // For these the children are markup that only makes sense inside the parent -
  // CSS text, SVG shapes, MathML - and would otherwise be dumped into the page
  // as a wall of stray text. `<script>` is on this list in the default schema
  // for the same reason.
  strip: [...(defaultSchema.strip ?? []), 'style', 'svg', 'math'],
};

// Release notes come from our own bucket over TLS, and are authored against the
// dialog that shows them: they style themselves, with `style` attributes and a
// `<style>` block. Sanitizing that away does not degrade them gracefully, so
// this schema keeps both for that one source.
//
// It is deliberately not "sanitize less": every sink that could get script into
// our origin - `<script>`, `<iframe>`, `<object>`, `<embed>`, `javascript:` - is
// still refused, and so is every element the strict schema drops. Only styling
// is trusted, and only for content we publish ourselves. Never reach for this
// for anything that arrives from an app, a board, or a user.
export const trustedSanitizeSchema = {
  ...sanitizeSchema,
  tagNames: [...(sanitizeSchema.tagNames ?? []), 'style'],
  attributes: {
    ...sanitizeSchema.attributes,
    '*': [...(sanitizeSchema.attributes?.['*'] ?? []), 'style'],
  },
  strip: (sanitizeSchema.strip ?? []).filter((tagName) => tagName !== 'style'),
};

interface MarkdownReaderProps {
  content?: string;
  allowElement?: AllowElement;
  onOpenExternalLink?: (url: string) => void;
  onOpenInternalLink?: (url: string) => void;
  onCopyCode?: () => void;
  classes?: { reader: string };
  /**
   * Render with the trusted schema, which keeps the inline styling the content
   * relies on. Only for documents Arduino publishes - see
   * `trustedSanitizeSchema`.
   */
  trustedSource?: boolean;
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
    trustedSource,
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
      // parse raw HTML, sanitize it, then give headings slug ids - including the
      // ones that came from raw HTML, which by then are ordinary elements
      rehypePlugins={
        [
          rehypeRaw,
          [
            rehypeSanitize,
            trustedSource ? trustedSanitizeSchema : sanitizeSchema,
          ],
          rehypeSlug,
        ] as PluggableList
      }
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
