import { ComponentMeta, ComponentStory } from '@storybook/react';
import { ReactLocation, Router } from '@tanstack/react-location';

import { Link, Text, TextSize } from '../lib/typography';

export default {
  title: 'Text',
  component: Text,
} as ComponentMeta<typeof Text>;

const Template: ComponentStory<typeof Text> = (args) => <Text {...args} />;

export const Default = Template.bind({});
Default.args = {
  children: 'Some text',
  title: 'Some text',
  italic: false,
  bold: false,
  size: TextSize.Small,
  uppercase: false,
  truncate: false,
  monospace: false,
};

export const TruncatedText: ComponentStory<typeof Text> = (args) => {
  const Component = Template.bind({});
  return (
    <div
      style={{
        width: '200px',
        overflow: 'hidden',
        border: '1px solid lightskyblue',
      }}
    >
      <Component {...args} />
    </div>
  );
};
TruncatedText.args = {
  ...Default.args,
  children: 'Some text that is very long and will be truncated',
  title: 'Some text that is very long and will be truncated',
  truncate: true,
};

const LinkTemplate: ComponentStory<typeof Link> = (args) => <Link {...args} />;
export const HrefLink = LinkTemplate.bind({});
HrefLink.args = {
  ...Default.args,
  href: 'https://www.google.com',
  children: 'Google',
  title: 'Google',
};

export const RouterLink: ComponentStory<typeof Link> = (args) => {
  const Component = LinkTemplate.bind({});
  const location = new ReactLocation();

  return (
    <Router location={location} routes={[{ path: '/some/path' }]}>
      <Component {...args} />
    </Router>
  );
};

RouterLink.args = {
  ...Default.args,
  children: 'Some path',
  title: 'Some path',
  to: '/some/path',
};
