import { describe, expect, it } from 'vitest';

import { LinkTarget, linkTarget } from './linkTarget';

// The classifier is the whole safety argument: anything that reaches the webview as an href must come
// back as 'file' or 'inert', never as something a top-level navigation could follow.
describe('linkTarget', () => {
  const cases: [string, string | undefined, LinkTarget][] = [
    [
      'a web page',
      'https://docs.arduino.cc',
      { kind: 'external', url: 'https://docs.arduino.cc' },
    ],
    [
      'an address',
      'mailto:hi@arduino.cc',
      { kind: 'external', url: 'mailto:hi@arduino.cc' },
    ],
    [
      'a phone number',
      'tel:+390123456',
      { kind: 'external', url: 'tel:+390123456' },
    ],
    [
      'a scheme-less URL',
      'www.arduino.cc',
      { kind: 'external', url: 'https://www.arduino.cc' },
    ],
    [
      'a relative path',
      'python/main.py',
      { kind: 'file', path: 'python/main.py' },
    ],
    [
      'a line hint',
      'python/main.py#L20',
      { kind: 'file', path: 'python/main.py' },
    ],
    ['a query', 'main.py?raw=1', { kind: 'file', path: 'main.py' }],
    [
      'an escaped space',
      'my%20app/main.py',
      { kind: 'file', path: 'my app/main.py' },
    ],
    ['a stray percent', 'main.py%', { kind: 'file', path: 'main.py%' }],
    [
      'a Windows path',
      'C:\\src\\main.py',
      { kind: 'file', path: 'C:\\src\\main.py' },
    ],
    [
      'a file URL',
      'file:///abs/main.py',
      { kind: 'file', path: '/abs/main.py' },
    ],
    [
      'a local file URL',
      'file://localhost/abs/main.py',
      { kind: 'file', path: '/abs/main.py' },
    ],
    [
      'a file URL with a drive',
      'file:///C:/app/main.py',
      { kind: 'file', path: 'C:/app/main.py' },
    ],
    [
      'a two-slash drive URL',
      'file://C:/app/main.py',
      { kind: 'file', path: 'C:/app/main.py' },
    ],
    ['a remote share', 'file://evil.com/share/x', { kind: 'inert' }],
    ['a script URL', 'javascript:alert(1)', { kind: 'inert' }],
    ['a script URL, shouting', 'JavaScript:alert(1)', { kind: 'inert' }],
    ['inline data', 'data:text/html,<b>x</b>', { kind: 'inert' }],
    ['an editor scheme', 'vscode://file/x', { kind: 'inert' }],
    ['a protocol-relative URL', '//evil.com/x', { kind: 'inert' }],
    ['a fragment', '#section', { kind: 'inert' }],
    ['nothing', undefined, { kind: 'inert' }],
    ['blank', '   ', { kind: 'inert' }],
  ];

  it.each(cases)('classifies %s', (_what, href, expected) => {
    expect(linkTarget(href)).toEqual(expected);
  });

  it('never hands back a URL the webview could navigate to', () => {
    cases.forEach(([, href]) => {
      const target = linkTarget(href);
      if (target.kind === 'external') {
        expect(target.url).toMatch(/^(?:https?|mailto|tel):/i);
      }
    });
  });
});
