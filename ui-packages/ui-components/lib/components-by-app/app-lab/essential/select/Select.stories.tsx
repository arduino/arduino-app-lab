import { Meta } from '@storybook/react-vite';
import React, { useState } from 'react';

import { Select } from './';

export default {
  title: 'App Lab Essential/Select',
  component: Select,
} as Meta<typeof Select>;

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#8a9499',
  fontWeight: 600,
};

const boards = [
  'Arduino Uno',
  'Arduino Nano',
  'Arduino Mega',
  'Arduino Leonardo',
  'Arduino Pro Mini',
  'Arduino Nano Every',
  'Arduino Nano 33 IoT',
  'Arduino Nano 33 BLE Sense',
  'Arduino Nano 33 BLE',
  'Arduino Nano 33 RP2040 Connect',
];

const singleSection = [
  {
    name: 'Boards',
    items: boards.map((board) => ({ id: board, label: board })),
  },
];

const singleSection4Elements = [
  {
    name: 'Boards',
    items: boards.slice(0, 4).map((board) => ({ id: board, label: board })),
  },
];

const doubleSections = [
  {
    name: 'Boards 0-4',
    items: boards.slice(0, 4).map((board) => ({ id: board, label: board })),
  },
  {
    name: 'Other Boards',
    items: boards.slice(5).map((board) => ({ id: board, label: board })),
  },
];

// Interactive Select with local state, plus a disabled variant.
const AllContent = () => {
  const [value, setValue] = useState(boards[0]);

  // On the baseline surface, like the App Lab dialogs: the filled Select takes the below-1
  // background, which is also the canvas colour.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '260px',
        padding: '16px',
        background: 'var(--surface-bg-baseline)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Default (4 elements)</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection4Elements}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Default (10 elements)</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Multiple sections</span>
        <Select
          label="Board"
          selectedId={value}
          sections={doubleSections}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Rounded</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection4Elements}
          rounded
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingBottom: '20px',
        }}
      >
        <span style={sectionLabelStyle}>Error</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection4Elements}
          error={new Error('Invalid selection')}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '8px',
          background: 'var(--surface-bg-below-1)',
        }}
      >
        <span style={sectionLabelStyle}>On a below-1 surface</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection4Elements}
          surface="below-1"
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Outlined</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection4Elements}
          outlined
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingBottom: '20px',
        }}
      >
        <span style={sectionLabelStyle}>Outlined with error</span>
        <Select
          label="Board"
          selectedId={value}
          sections={singleSection4Elements}
          outlined
          error={new Error('Invalid selection')}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>No label</span>
        <Select
          selectedId={value}
          sections={singleSection4Elements}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>
          Display value (selection not in the list)
        </span>
        <Select
          label="Board"
          displayValue="Arduino UNO Q"
          sections={singleSection4Elements}
          onChange={(key) => setValue(String(key))}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Disabled outlined</span>
        <Select
          label="Board"
          selectedId={boards[0]}
          sections={singleSection}
          outlined
          disabled
          onChange={() => undefined}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={sectionLabelStyle}>Disabled</span>
        <Select
          label="Board"
          selectedId={boards[0]}
          sections={singleSection}
          disabled
          onChange={() => undefined}
        />
      </div>
    </div>
  );
};

export const AllVariants = () => <AllContent />;
