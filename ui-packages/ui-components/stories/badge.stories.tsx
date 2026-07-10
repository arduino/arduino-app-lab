import { ComponentMeta } from '@storybook/react';

import {
  Badge,
  BadgeSize,
  BadgeStyle,
  BadgeVariant,
} from '../lib/components-by-app/app-lab';

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.5 4.5L6 12L2.5 8.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default {
  title: 'Badge',
  component: Badge,
} as ComponentMeta<typeof Badge>;

// Theme wrapper helpers, so every story is shown on a background
// that matches the theme it's meant to be read against.
const DarkThemeWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#171e21', padding: '16px', borderRadius: '4px' }}>
    {children}
  </div>
);

const LightThemeWrapper = ({ children }: { children: React.ReactNode }) => (
  <div
    className="light-theme"
    style={{ background: '#ffffff', padding: '16px', borderRadius: '4px' }}
  >
    {children}
  </div>
);

// All Ghost combinations
export const GhostAllCombinations = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge style={BadgeStyle.Ghost}>Ghost</Badge>
      <Badge style={BadgeStyle.Ghost} icon={<CheckIcon />}>
        Ghost
      </Badge>
      <Badge style={BadgeStyle.Ghost} uppercase={false}>
        Ghost
      </Badge>
      <Badge style={BadgeStyle.Ghost} uppercase={false} icon={<CheckIcon />}>
        Ghost
      </Badge>
    </div>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Badge style={BadgeStyle.Ghost} size={BadgeSize.Small}>
        Ghost Small
      </Badge>
      <Badge
        style={BadgeStyle.Ghost}
        size={BadgeSize.Small}
        icon={<CheckIcon />}
      >
        Ghost Small
      </Badge>
      <Badge
        style={BadgeStyle.Ghost}
        size={BadgeSize.Small}
        uppercase={false}
      >
        Ghost Small
      </Badge>
      <Badge
        style={BadgeStyle.Ghost}
        size={BadgeSize.Small}
        uppercase={false}
        icon={<CheckIcon />}
      >
        Ghost Small
      </Badge>
    </div>
  </div>
);

// All variants – every combination of style × size × icon × uppercase
const variants = [
  { variant: BadgeVariant.Neutral, label: 'Neutral' },
  { variant: BadgeVariant.Positive, label: 'Positive' },
  { variant: BadgeVariant.Warning, label: 'Warning' },
  { variant: BadgeVariant.Error, label: 'Error' },
  { variant: BadgeVariant.Accent, label: 'Accent' },
  { variant: BadgeVariant.Alert, label: 'Alert' },
];

const AllVariantsContent = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {variants.map(({ variant, label }) => (
      <div
        key={label}
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        <span style={{ fontSize: '11px', color: '#8a9499', fontWeight: 600 }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge variant={variant} style={BadgeStyle.Solid}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Solid} icon={<CheckIcon />}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} icon={<CheckIcon />}>
            {label}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge variant={variant} style={BadgeStyle.Solid} size={BadgeSize.Small}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} size={BadgeSize.Small}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Solid} size={BadgeSize.Small} icon={<CheckIcon />}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} size={BadgeSize.Small} icon={<CheckIcon />}>
            {label}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge variant={variant} style={BadgeStyle.Solid} uppercase={false}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} uppercase={false}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Solid} uppercase={false} icon={<CheckIcon />}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} uppercase={false} icon={<CheckIcon />}>
            {label}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge variant={variant} style={BadgeStyle.Solid} size={BadgeSize.Small} uppercase={false}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} size={BadgeSize.Small} uppercase={false}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Solid} size={BadgeSize.Small} uppercase={false} icon={<CheckIcon />}>
            {label}
          </Badge>
          <Badge variant={variant} style={BadgeStyle.Light} size={BadgeSize.Small} uppercase={false} icon={<CheckIcon />}>
            {label}
          </Badge>
        </div>
      </div>
    ))}
  </div>
);

export const AllVariantsDarkTheme = () => (
  <DarkThemeWrapper>
    <AllVariantsContent />
  </DarkThemeWrapper>
);

export const AllVariantsLightTheme = () => (
  <LightThemeWrapper>
    <AllVariantsContent />
  </LightThemeWrapper>
);
