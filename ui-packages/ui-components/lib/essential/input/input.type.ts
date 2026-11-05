export enum InputValidateBehavior {
  OnChange,
  OnBlur,
}

export type InputSize = 'x-small' | 'small' | 'medium' | 'large';

// The surface the field sits on; a filled field takes the other of the two backgrounds.
export type InputSurface = 'baseline' | 'below-1';

export enum InputStyle {
  CloudEditor = 'cloud-editor',
  AppLab = 'app-lab',
}
