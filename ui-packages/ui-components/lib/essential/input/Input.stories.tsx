import { Meta } from '@storybook/react-vite';
import React, { useState } from 'react';

import { Input, InputProps, InputStyle } from './';

export default {
  title: 'Essential/Input',
  component: Input,
} as Meta<typeof Input>;

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#8a9499',
  fontWeight: 600,
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const sizes: { size: InputProps['inputSize']; label: string }[] = [
  { size: 'x-small', label: 'X-Small (20px)' },
  { size: 'small', label: 'Small (28px)' },
  { size: 'medium', label: 'Medium (36px, default)' },
  { size: 'large', label: 'Large (48px)' },
];

// Each field keeps its own value so every example can be typed in.
const Field = ({
  title,
  initialValue = '',
  ...props
}: Omit<InputProps, 'value' | 'onChange'> & {
  title: string;
  initialValue?: string;
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <div style={columnStyle}>
      <span style={sectionLabelStyle}>{title}</span>
      <Input {...props} value={value} onChange={setValue} />
    </div>
  );
};

// A filled field takes the other surface's background, so the examples sit on the baseline
// surface like the App Lab dialogs. The canvas itself is below-1.
const AppLabContent = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      width: '300px',
      padding: '16px',
      background: 'var(--surface-bg-baseline)',
    }}
  >
    {sizes.map(({ size, label }) => (
      <Field
        key={label}
        title={`Filled · ${label}`}
        inputStyle={InputStyle.AppLab}
        inputSize={size}
        placeholder="Placeholder"
      />
    ))}

    <Field
      title="Filled · label"
      inputStyle={InputStyle.AppLab}
      label="Label"
      placeholder="Placeholder"
    />

    <Field
      title="Filled · label and value"
      inputStyle={InputStyle.AppLab}
      label="Label"
      initialValue="Value"
    />

    {sizes.map(({ size, label }) => (
      <Field
        key={label}
        title={`Outlined · ${label}`}
        inputStyle={InputStyle.AppLab}
        inputSize={size}
        outlined
        placeholder="Placeholder"
      />
    ))}

    <Field
      title="Outlined · label"
      inputStyle={InputStyle.AppLab}
      outlined
      label="Label"
      placeholder="Placeholder"
    />

    <div
      style={{
        ...columnStyle,
        padding: '8px',
        background: 'var(--surface-bg-below-1)',
      }}
    >
      <Field
        title="Filled · on a below-1 surface"
        inputStyle={InputStyle.AppLab}
        surface="below-1"
        label="Label"
        placeholder="Placeholder"
      />
    </div>

    <Field
      title="Error · small, message below with background"
      inputStyle={InputStyle.AppLab}
      inputSize="small"
      errorBelow
      initialValue="Value"
      error={new Error('Feedback message')}
    />

    <Field
      title="Error · medium, message below"
      inputStyle={InputStyle.AppLab}
      errorBelow
      label="Label"
      initialValue="Value"
      error={new Error('Feedback message')}
    />

    <Field
      title="Error · outlined"
      inputStyle={InputStyle.AppLab}
      outlined
      errorBelow
      label="Label"
      initialValue="Value"
      error={new Error('Feedback message')}
    />

    <Field
      title="Password"
      inputStyle={InputStyle.AppLab}
      sensitive
      label="Password"
      initialValue="secret"
    />

    <Field
      title="Disabled · filled"
      inputStyle={InputStyle.AppLab}
      disabled
      placeholder="Placeholder"
    />

    <Field
      title="Disabled · outlined"
      inputStyle={InputStyle.AppLab}
      outlined
      disabled
      placeholder="Placeholder"
    />
  </div>
);

const CloudEditorContent = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      width: '300px',
    }}
  >
    <Field title="Default" label="Label" />
    <Field title="Default · value" label="Label" initialValue="Value" />
    <Field title="Small" small label="Label" />
    <Field
      title="Error"
      label="Label"
      initialValue="Value"
      error={new Error('Feedback message')}
    />
    <Field title="Disabled" label="Label" disabled />
  </div>
);

export const AppLab = () => <AppLabContent />;

export const CloudEditor = () => <CloudEditorContent />;
