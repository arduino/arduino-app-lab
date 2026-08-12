import { render } from '@testing-library/react';
import { Element, Root } from 'hast';
import rehypeSanitize from 'rehype-sanitize';
import { describe, expect, it } from 'vitest';

import MarkdownReader, { sanitizeSchema } from './MarkdownReader';

const renderMarkdown = (content: string): HTMLElement =>
  render(<MarkdownReader content={content} />).container;

describe('MarkdownReader sanitizing', () => {
  it('strips script tags', () => {
    const container = renderMarkdown(
      'before\n\n<script>window.pwned = true;</script>\n\nafter',
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('pwned');
  });

  it('strips inline event handlers', () => {
    const container = renderMarkdown(
      '<img src="/file-content-assets/x.png" onerror="window.pwned = true">',
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('onerror')).toBeNull();
  });

  it('strips iframes, including srcdoc payloads', () => {
    const container = renderMarkdown(
      '<iframe srcdoc="&lt;script&gt;parent.pwned = true&lt;/script&gt;"></iframe>',
    );

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('srcdoc');
  });

  it('strips object and embed tags', () => {
    const container = renderMarkdown(
      '<object data="/etc/passwd"></object>\n\n<embed src="/etc/passwd">',
    );

    expect(container.querySelector('object')).toBeNull();
    expect(container.querySelector('embed')).toBeNull();
  });

  it('strips javascript: urls from links', () => {
    // eslint-disable-next-line no-script-url
    const container = renderMarkdown(
      '[click me](javascript:window.pwned=true)',
    );

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBeNull();
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('strips style tags and style attributes', () => {
    const container = renderMarkdown(
      '<style>body { display: none }</style>\n\n<p style="position:fixed;inset:0">overlay</p>',
    );

    expect(container.querySelector('style')).toBeNull();
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull();
  });

  // A disallowed element is unwrapped rather than deleted, so dropping the tag
  // alone would leave the CSS behind as a wall of visible text.
  it('drops the contents of a style tag, not just the tag', () => {
    const container = renderMarkdown('<style>body { display: none }</style>');

    expect(container.textContent).not.toContain('display: none');
  });
});

describe('MarkdownReader in-page anchors', () => {
  // Every fragment link has to point at an id that exists in the document it was
  // rendered into, or the jump lands nowhere.
  const expectFragmentTargetsResolve = (container: HTMLElement): void => {
    const fragmentLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
    );
    expect(fragmentLinks.length).toBeGreaterThan(0);

    fragmentLinks.forEach((link) => {
      const id = decodeURIComponent(
        link.getAttribute('href')?.slice(1) as string,
      );
      expect(
        container.querySelector(`[id="${id}"]`),
        `no element with id "${id}" for ${link.getAttribute('href')}`,
      ).not.toBeNull();
    });
  };

  it('resolves gfm footnote references and back-references', () => {
    const container = renderMarkdown('text[^1]\n\n[^1]: the note');

    expectFragmentTargetsResolve(container);
  });

  it('resolves a link to a heading', () => {
    const container = renderMarkdown(
      '## Getting started\n\n[jump](#getting-started)',
    );

    expectFragmentTargetsResolve(container);
  });

  it('resolves a link to an id the author wrote', () => {
    const container = renderMarkdown(
      '<h2 id="wiring">Wiring</h2>\n\n[jump](#wiring)',
    );

    expect(container.querySelector('h2')?.id).toBe('wiring');
    expectFragmentTargetsResolve(container);
  });

  // A hash arriving from outside - a Learn deep link is navigated to with the
  // authored anchor - can only match an id that was left as authored.
  it('keeps an authored id reachable by its unprefixed hash', () => {
    const container = renderMarkdown('<a name="step-one"></a>');

    expect(container.querySelector('[name="step-one"]')).not.toBeNull();
  });
});

describe('MarkdownReader supported authored html', () => {
  it('keeps inline data: images', () => {
    const dataUri = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const container = renderMarkdown(`![dot](${dataUri})`);

    expect(container.querySelector('img')?.getAttribute('src')).toBe(dataUri);
  });

  it('keeps video with its sources and controls', () => {
    const container = renderMarkdown(
      '<video controls poster="/file-content-assets//app/thumb.png"><source src="/file-content-assets//app/demo.mp4" type="video/mp4"></video>',
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('controls')).not.toBeNull();
    expect(video?.getAttribute('poster')).toBe(
      '/file-content-assets//app/thumb.png',
    );
    expect(container.querySelector('source')?.getAttribute('src')).toBe(
      '/file-content-assets//app/demo.mp4',
    );
  });

  it('keeps figures with their captions', () => {
    const container = renderMarkdown(
      '<figure><img src="/file-content-assets//app/wiring.png"><figcaption>Wiring</figcaption></figure>',
    );

    expect(container.querySelector('figure')).not.toBeNull();
    expect(container.querySelector('figcaption')?.textContent).toContain(
      'Wiring',
    );
  });

  it('keeps text semantics markdown has no syntax for', () => {
    const container = renderMarkdown(
      '<p><mark>highlit</mark> <abbr title="Inter-Integrated Circuit">I2C</abbr> <u>underlined</u> <small>aside</small></p>',
    );

    expect(container.querySelector('mark')).not.toBeNull();
    expect(container.querySelector('abbr')?.getAttribute('title')).toBe(
      'Inter-Integrated Circuit',
    );
    expect(container.querySelector('u')).not.toBeNull();
    expect(container.querySelector('small')).not.toBeNull();
  });

  // Inline SVG needs an allow-list this schema has no notion of, so it goes -
  // but it has to go whole, not leave its shapes' text behind.
  it('removes inline svg without leaking its contents', () => {
    const container = renderMarkdown(
      '<svg viewBox="0 0 1 1"><text>leaked</text></svg>',
    );

    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).not.toContain('leaked');
  });
});

describe('MarkdownReader with a trusted source', () => {
  const renderTrusted = (content: string): HTMLElement =>
    render(<MarkdownReader content={content} trustedSource />).container;

  it('keeps style attributes', () => {
    const container = renderTrusted('<p style="text-align:center">notes</p>');

    expect(container.querySelector('p')?.style.textAlign).toBe('center');
  });

  it('keeps style tags and their css', () => {
    const container = renderTrusted(
      '<style>.release-note { color: red }</style>\n\n<p class="release-note">notes</p>',
    );

    expect(container.querySelector('style')?.textContent).toContain(
      'color: red',
    );
  });

  // Trusting the source is about styling, nothing else: the sinks that could get
  // script running in our origin stay closed.
  it('still refuses script, iframes, objects and javascript: urls', () => {
    const container = renderTrusted(
      [
        '<script>window.pwned = true;</script>',
        '<iframe srcdoc="&lt;script&gt;parent.pwned = true&lt;/script&gt;"></iframe>',
        '<object data="/etc/passwd"></object>',
        '<embed src="/etc/passwd">',
        // eslint-disable-next-line no-script-url
        '[click me](javascript:window.pwned=true)',
      ].join('\n\n'),
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('object')).toBeNull();
    expect(container.querySelector('embed')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(container.innerHTML).not.toContain('pwned');
    expect(container.innerHTML).not.toContain('srcdoc');
  });

  it('still strips inline event handlers', () => {
    const container = renderTrusted(
      '<img src="/file-content-assets/x.png" style="width:10px" onerror="window.pwned = true">',
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('onerror')).toBeNull();
  });
});

describe('MarkdownReader supported content', () => {
  it('keeps headings with their slug ids', () => {
    const container = renderMarkdown('## Getting started');

    expect(container.querySelector('h2')?.id).toBe('getting-started');
  });

  it('keeps app assets served by the file-content-assets route', () => {
    const container = renderMarkdown(
      '![diagram](/file-content-assets/home/arduino/ArduinoApps/my-app/diagram.png)',
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/file-content-assets/home/arduino/ArduinoApps/my-app/diagram.png',
    );
  });

  it('keeps details and summary collapsibles', () => {
    const container = renderMarkdown(
      '<details><summary>More</summary>\n\nhidden body\n\n</details>',
    );

    expect(container.querySelector('details')).not.toBeNull();
    expect(container.querySelector('summary')?.textContent).toContain('More');
    expect(container.textContent).toContain('hidden body');
  });

  it('keeps gfm tables and their alignment', () => {
    const container = renderMarkdown(
      ['| a | b |', '| :-- | --: |', '| 1 | 2 |'].join('\n'),
    );

    const headers = container.querySelectorAll<HTMLElement>('th');
    expect(headers).toHaveLength(2);
    expect(headers[0].style.textAlign).toBe('left');
    expect(headers[1].style.textAlign).toBe('right');
  });

  it('keeps gfm task lists', () => {
    const container = renderMarkdown('- [x] done\n- [ ] todo');

    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(container.querySelector('ul')?.className).toContain(
      'contains-task-list',
    );
  });

  it('renders fenced code blocks', () => {
    const container = renderMarkdown('```python\nprint("hi")\n```');

    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.textContent).toContain('print("hi")');
  });

  // The class never reaches the DOM - TagCode consumes it to pick the
  // highlighter language - so guard it on the schema instead.
  it('keeps the language class the code highlighter reads', () => {
    const transform = rehypeSanitize(sanitizeSchema) as (root: Root) => Root;

    const sanitized = transform({
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'code',
          properties: { className: ['language-python'] },
          children: [],
        },
      ],
    });

    expect((sanitized.children[0] as Element).properties?.className).toEqual([
      'language-python',
    ]);
  });

  it('keeps external links', () => {
    const container = renderMarkdown('[docs](https://docs.arduino.cc)');

    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://docs.arduino.cc',
    );
  });

  it('keeps classes authored docs use for layout', () => {
    const container = renderMarkdown('<div class="columns">side by side</div>');

    expect(container.querySelector('div.columns')).not.toBeNull();
  });
});
