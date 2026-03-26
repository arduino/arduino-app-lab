import './message.css';

import React, { ReactElement, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

import { GetCurrentVersion } from '../../wailsjs/go/app/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

type FrontMatterMessage = {
  title: string;
};

type MarkdownMessage = {
  frontMatter: FrontMatterMessage;
  markdown: string;
};

function processMarkdown(markdown: string): MarkdownMessage {
  try {
    return {
      frontMatter: processFrontmatter(markdown),
      markdown: extractMarkdown(markdown),
    };
  } catch (error) {
    return {
      frontMatter: {
        title: 'Warning',
      },
      markdown,
    };
  }
}

function extractMarkdown(markdown: string): string {
  try {
    const fullMarkdown = /---(.*)---(.*)/s;
    const y = fullMarkdown.exec(markdown);
    return y?.[2] || markdown;
  } catch (error) {
    return markdown;
  }
}

function processFrontmatter(markdown: string): FrontMatterMessage {
  let title = 'Warning';
  try {
    const fullFrontMatter = /^(---)(.*)(---)/s.exec(markdown);
    const frontMatterContent = fullFrontMatter?.[2];

    const fields = frontMatterContent?.split('\n') || [];
    for (const field of fields) {
      if (field.startsWith('title:')) {
        title = field.substring(6);
      }
    }
  } catch (error) {
    // do nothing
    console.log(`Error processing frontmatter`, error);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    return {
      title,
    };
  }
}

export const MarkdownReaderTagA = ({
  node,
  children,
  ...props
}: ReactMarkdownProps): ReactElement => {
  const href = node.properties?.href as string | undefined;

  const openUrl =
    (href: string | undefined) =>
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
      if (href) {
        BrowserOpenURL(href || '');
      } else {
        e.preventDefault();
      }
    };

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={openUrl(href)}
    >
      {children}
    </a>
  );
};

const messageBucketUrl =
  import.meta.env.VITE_MESSAGE_BUCKET_URL ||
  'https://downloads.arduino.cc/AppLab/Stable/messages';

/** All logic is self-contained here, to enforce isolation and make this feature as robust as possible
 * The code is super-defensive so that this component will never throw an error in case of network failures
 * or other external circumstances
 */
function MessageDialog(): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const messagesCheckedRef = useRef<boolean>(false);
  const [data, setData] = useState<string>();
  const [title, setTitle] = useState<string>('Warning');
  const [version, setVersion] = useState<string>();

  closeButtonRef.current?.addEventListener('click', () => {
    dialogRef.current?.close();
  });

  useEffect(() => {
    if (messagesCheckedRef.current) {
      return;
    }
    let currentVersion = 'unknown';
    const fetchMessage = async (): Promise<void> => {
      try {
        currentVersion = await GetCurrentVersion();
        setVersion(currentVersion);
        const resp: Response = await fetch(
          `${messageBucketUrl}/message_${currentVersion}.md?ck=${new Date().getTime()}`,
        );
        if (resp.status == 200) {
          const md = await resp.text();
          const { frontMatter, markdown } = processMarkdown(md);
          setData(markdown);
          setTitle(frontMatter.title);
          dialogRef.current?.showModal();
        }
      } catch (error) {
        // do nothing, just do not open the modal
      }
    };
    try {
      fetchMessage();
    } catch (error) {
      // do nothing, just log
      console.log(
        `Error checking message for version ${currentVersion}`,
        error,
      );
    } finally {
      messagesCheckedRef.current = true;
    }
  }, []);

  return (
    <dialog className="message-dialog" ref={dialogRef}>
      <header className="message-dialog-header">
        <div className="message-dialog-header-title">{title}</div>
        <div className="message-dialog-header-close">
          <button
            id="close-button"
            className="close-button"
            ref={closeButtonRef}
            title={version}
            data-testid={version}
          >
            Close
          </button>
        </div>
      </header>
      <main className="message-dialog-content">
        <ReactMarkdown
          components={{
            a: MarkdownReaderTagA,
          }}
        >
          {data || ''}
        </ReactMarkdown>
      </main>
      <footer className="message-dialog-footer">
        Arduino App Lab v.{version}
      </footer>
    </dialog>
  );
}

const messageContainer = document.getElementById('message-dialog-container');

if (messageContainer) {
  const message = createRoot(messageContainer);

  message.render(
    <React.StrictMode>
      <MessageDialog />
    </React.StrictMode>,
  );
}

export { MessageDialog };
