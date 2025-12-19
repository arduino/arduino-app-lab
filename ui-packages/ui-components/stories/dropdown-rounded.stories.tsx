import { ComponentMeta, ComponentStory } from '@storybook/react';

import { DropdownRounded } from '../lib/essential/dropdown-rounded';

export default {
  title: 'DropdownRounded',
  component: DropdownRounded,
  parameters: { actions: { argTypesRegex: '^on.*' } },
} as ComponentMeta<typeof DropdownRounded>;

const Template: ComponentStory<typeof DropdownRounded> = (args) => (
  <div style={{ position: 'relative', height: '100vh' }}>
    <div
      style={{
        position: 'absolute',
        bottom: '30%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <DropdownRounded {...args} />
    </div>
  </div>
);

export const Default = Template.bind({});
Default.args = {
  items: new Array(6)
    .fill(0)
    .map((_, i) => ({ text: `Item ${i + 1}`, value: i + 1 })),
  selectedValue: 1,
};
