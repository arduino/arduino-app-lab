import {
  LearnListItem,
  LearnResource,
} from '@cloud-editor-mono/ui-components/lib/app-lab-learn';

export const mockLearnList = (): LearnListItem[] => {
  return [
    {
      id: '1',
      title: 'Hpw to use App Lab',
      description:
        'Learn how to use App Lab to build, test, and deploy apps directly on your board. This article covers the main features so you can get started quickly. Learn how to use App Lab to build, test, and deploy apps directly on your board. This article covers the main features so you can get started quickly. Learn how to use App Lab to build, test, and deploy apps directly on your board. This article covers the main features so you can get started quickly.',
      tags: [
        { id: 'overview', label: 'Overview' },
        { id: 'apps', label: 'Apps' },
      ],
      lastRevision: new Date('2024-01-01'),
      icon: 'navigation',
    },
    {
      id: '2',
      title: 'Uno Q Hardware',
      description:
        'An app is a set of instructions that defines how your board behaves. This article explains what apps are and what they can do.',
      tags: [
        {
          id: 'hardware',
          label: 'Hardware',
        },
      ],
      lastRevision: new Date('2024-02-15'),
      icon: 'hardware',
    },
    {
      id: '3',
      title: 'Advanced Robotics with Arduino',
      description: 'Explore advanced robotics concepts with Arduino.',
      tags: [
        {
          id: 'sketches',
          label: 'Sketches',
        },
        {
          id: 'python',
          label: 'Python',
        },
      ],
      lastRevision: new Date('2024-03-10'),
      icon: 'navigation-2',
    },
    {
      id: '4',
      title: 'Arduino for Kids',
      description: 'A fun introduction to Arduino for young learners.',
      tags: [{ id: 'kids', label: 'Kids' }],
      lastRevision: new Date('2024-04-01'),
      icon: 'account',
    },
    {
      id: '5',
      title: 'Arduino in Education',
      description: 'Using Arduino to enhance learning in schools.',
      tags: [
        { id: 'examples', label: 'Examples' },
        { id: 'bricks', label: 'Bricks' },
      ],
      lastRevision: new Date('2024-05-01'),
      icon: 'user',
    },
    {
      id: '6',
      title: 'Arduino and Machine Learning',
      description: 'Integrating machine learning with Arduino projects.',
      tags: [
        { id: 'ai', label: 'AI' },
        { id: 'ml', label: 'ML' },
        { id: 'ai-models', label: 'AI Models' },
      ],
      lastRevision: new Date('2024-06-01'),
      icon: 'hardware',
    },
  ];
};

const MOCK_LEARN_RESOURCE_CONTENT = `
# A demo of \`react-markdown\`

\`react-markdown\` is a markdown component for React.

👉 Changes are re-rendered as you type.

👈 Try writing some markdown on the left.

## Overview

* Follows [CommonMark](https://commonmark.org)
* Optionally follows [GitHub Flavored Markdown](https://github.github.com/gfm/)
* Renders actual React elements instead of using \`dangerouslySetInnerHTML\`
* Lets you define your own components (to render \`MyHeading\` instead of \`'h1'\`)
* Has a lot of plugins

## Contents

Here is an example of a plugin in action
([\`remark-toc\`](https://github.com/remarkjs/remark-toc)).
**This section is replaced by an actual table of contents**.

## Syntax highlighting

Here is an example of a plugin to highlight code:
[\`rehype-starry-night\`](https://github.com/rehypejs/rehype-starry-night).

\`\`\`js
import React from 'react'
import ReactDom from 'react-dom'
import {MarkdownHooks} from 'react-markdown'
import rehypeStarryNight from 'rehype-starry-night'

const markdown = \`
# Your markdown here
\`

ReactDom.render(
  <MarkdownHooks rehypePlugins={[rehypeStarryNight]}>{markdown}</MarkdownHooks>,
  document.querySelector('#content')
)
\`\`\`

Pretty neat, eh?

## GitHub flavored markdown (GFM)

For GFM, you can *also* use a plugin:
[\`remark-gfm\`](https://github.com/remarkjs/react-markdown#use).
It adds support for GitHub-specific extensions to the language:
tables, strikethrough, tasklists, and literal URLs.

These features **do not work by default**.
👆 Use the toggle above to add the plugin.

| Feature    | Support              |
| ---------: | :------------------- |
| CommonMark | 100%                 |
| GFM        | 100% w/ \`remark-gfm\` |

~~strikethrough~~

* [ ] task list
* [x] checked item

https://example.com

## HTML in markdown

⚠️ HTML in markdown is quite unsafe, but if you want to support it, you can
use [\`rehype-raw\`](https://github.com/rehypejs/rehype-raw).
You should probably combine it with
[\`rehype-sanitize\`](https://github.com/rehypejs/rehype-sanitize).

<blockquote>
  👆 Use the toggle above to add the plugin.
</blockquote>

## Components

You can pass components to change things:

\`\`\`js
import React from 'react'
import ReactDom from 'react-dom'
import Markdown from 'react-markdown'
import MyFancyRule from './components/my-fancy-rule.js'

const markdown = \`
# Your markdown here
\`

ReactDom.render(
  <Markdown
    components={{
      // Use h2s instead of h1s
      h1: 'h2',
      // Use a component instead of hrs
      hr(props) {
        const {node, ...rest} = props
        return <MyFancyRule {...rest} />
      }
    }}
  >
    {markdown}
  </Markdown>,
  document.querySelector('#content')
)
\`\`\`

## More info?

Much more info is available in the
[readme on GitHub](https://github.com/remarkjs/react-markdown)!

***

A component by [Espen Hovlandsdal](https://espen.codes/)
`;

export const mockLearnResource = (resourceId: string): LearnResource => {
  return {
    id: resourceId,
    title: `Learn Resource ${resourceId}`,
    content: MOCK_LEARN_RESOURCE_CONTENT,
    icon: 'navigation-2',
    description:
      'This is a sample resource content to demonstrate markdown rendering.',
    lastRevision: new Date(),
  };
};
