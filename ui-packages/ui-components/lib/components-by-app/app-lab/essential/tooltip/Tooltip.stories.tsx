import { Meta } from '@storybook/react-vite';
import React from 'react';

import { Button } from '../button';
import { useTooltip } from './';

// The tooltip folder exports a `useTooltip` hook rather than a component, so we
// document it through a small demo: hover the button to reveal the tooltip.
const TooltipDemo = ({ content }: { content: string }) => {
  const { props, renderTooltip } = useTooltip({
    content,
  });

  return (
    <span {...props} style={{ display: 'inline-flex' }}>
      <Button>Hover me</Button>
      {renderTooltip()}
    </span>
  );
};

export default {
  title: 'App Lab Essential/Tooltip',
  component: TooltipDemo,
} as Meta<typeof TooltipDemo>;

export const DarkTheme = () => <TooltipDemo content="I'm a tooltip" />;
