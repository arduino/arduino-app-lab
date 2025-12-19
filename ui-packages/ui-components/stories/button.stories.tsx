import { Copy } from '@cloud-editor-mono/images/assets/icons';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import { Button, ButtonType } from '../lib/essential/button';
import { TextSize } from '../lib/typography';

export default {
  title: 'Button',
  component: Button,
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args) => <Button {...args} />;

export const Default = Template.bind({});
Default.args = {
  children: <>{'Click me'}</>,
  size: TextSize.Small,
};

export const Primary = Template.bind({});
Default.args = {
  children: <>{'Click me'}</>,
  size: TextSize.Small,
  type: ButtonType.Primary,
};

export const Secondary = Template.bind({});
Default.args = {
  children: <>{'Click me'}</>,
  size: TextSize.Small,
  type: ButtonType.Secondary,
};

export const Tertiary = Template.bind({});
Default.args = {
  children: <>{'Click me'}</>,
  size: TextSize.Small,
  type: ButtonType.Tertiary,
};

export const WithIcon = Template.bind({});
WithIcon.args = {
  children: <>{'Click me'}</>,
  size: TextSize.Small,
  type: ButtonType.Primary,
  Icon: Copy,
  iconPosition: 'left',
};
