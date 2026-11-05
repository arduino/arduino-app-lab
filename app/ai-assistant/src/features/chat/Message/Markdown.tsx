import { Children, isValidElement, memo, ReactElement, ReactNode } from 'react';
import ReactMarkdown, { Components, uriTransformer } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  CodeBlock,
  Heading,
  InlineDiff,
  Link,
  linkTarget,
  List,
  Table,
  Text,
} from '../../../ui';
import styles from './message.module.scss';
import { markdownBlocks } from './utils/messageSegments';

const toPlainText = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(toPlainText).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return toPlainText(node.props.children);
  }

  return '';
};

/**
 * Flattens a GFM table's thead/tbody/tr/th/td nodes into plain-string rows so we
 * can feed our agnostic <Table>. First row = headers (GFM tables always have one).
 */
const tableRows = (node: ReactNode): string[][] => {
  const rows: string[][] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return;
    }

    if (child.type === 'tr') {
      const cells: string[] = [];
      Children.forEach(child.props.children, (cell) => {
        if (
          isValidElement<{ children?: ReactNode }>(cell) &&
          (cell.type === 'th' || cell.type === 'td')
        ) {
          cells.push(toPlainText(cell.props.children));
        }
      });
      rows.push(cells);
      return;
    }

    // thead / tbody wrappers — recurse to reach the rows.
    rows.push(...tableRows(child.props.children));
  });

  return rows;
};

/**
 * Second-level dispatch: maps markdown nodes to UI primitives. Used only for
 * `text` parts, which carry the agent's prose/GFM (`agent_message_chunk`). The
 * first-level dispatch — choosing this renderer vs a structured component — is
 * the part-type switch in Message.tsx.
 */
export const markdownComponents: Components = {
  table({ children }) {
    const [headers, ...rows] = tableRows(children);
    if (!headers) {
      return null;
    }

    return <Table headers={headers} rows={rows} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  a: Link,
  img({ src, alt, title }) {
    if (!src) {
      return <>{alt}</>;
    }

    // A file is named by the path a click opens, as Link's tooltip names it; any other target keeps the src as written.
    const target = linkTarget(src);
    const path = target.kind === 'file' ? target.path : undefined;
    return (
      <Link href={src} title={title ?? (path ? undefined : src)}>
        {alt || (path ?? src)}
      </Link>
    );
  },
  p({ children }) {
    return <Text>{children}</Text>;
  },
  ul({ children }) {
    return <List as="ul">{children}</List>;
  },
  ol({ children, start }) {
    return (
      <List as="ol" start={start}>
        {children}
      </List>
    );
  },
  li({ children }) {
    const nodes = Array.isArray(children) ? children : [children];
    const inlineNodes: ReactNode[] = [];
    const nestedLists: ReactNode[] = [];

    nodes.forEach((node) => {
      if (isValidElement(node) && (node.type === 'ul' || node.type === 'ol')) {
        nestedLists.push(node);
        return;
      }

      inlineNodes.push(node);
    });

    return (
      <li>
        {inlineNodes.length > 0 && <Text>{inlineNodes}</Text>}
        {nestedLists}
      </li>
    );
  },
  h1({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h2({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h3({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h4({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h5({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  h6({ children }) {
    return <Heading>{toPlainText(children)}</Heading>;
  },
  code({ inline, className, children }) {
    if (inline) {
      return <code className={className}>{children}</code>;
    }

    const text = String(children).replace(/\n$/, '');
    const isDiff = className?.includes('language-diff');

    if (isDiff) {
      return <InlineDiff>{text}</InlineDiff>;
    }

    return <CodeBlock code={text} />;
  },
};

// The default turns every scheme but http(s), mailto and tel into javascript:void(0); Link opens file:// in the editor.
const transformLinkUri = (href: string): string =>
  /^file:\/\//i.test(href) ? href : uriTransformer(href);

const remarkPlugins = [remarkGfm];

// A streaming reply re-renders on every token and typewriter tick: text that did not change must not be parsed again.
const MarkdownBody = memo(function MarkdownBody({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={markdownComponents}
      transformLinkUri={transformLinkUri}
    >
      {text}
    </ReactMarkdown>
  );
});

export const Markdown = ({ text }: { text: string }): ReactElement => (
  <div className={styles['markdown']}>
    <MarkdownBody text={text} />
  </div>
);

// Only the last block of the live tail changes, so earlier blocks keep their parse; the settled reply renders as one.
export const StreamingMarkdown = ({ text }: { text: string }): ReactElement => (
  <div className={styles['markdown']}>
    {markdownBlocks(text).map((block, i) => (
      <MarkdownBody key={i} text={block} />
    ))}
  </div>
);
