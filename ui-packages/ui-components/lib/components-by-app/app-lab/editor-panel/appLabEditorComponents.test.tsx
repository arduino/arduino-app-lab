import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import buttonStyles from '../essential/button/button.module.scss';
import iconButtonStyles from '../essential/icon-button/icon-button.module.scss';
import { appLabEditorComponents } from './appLabEditorComponents';
import AppLabEditorPanel from './AppLabEditorPanel';
import { AppLabEditorPanelLogic } from './appLabEditorPanel.type';

const editorPanelProps = vi.hoisted(() => ({ current: {} as object }));

// Only what AppLabEditorPanel takes from the barrel: importing the whole barrel
// starts a Worker, which jsdom does not have.
vi.mock(
  '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab',
  () => ({
    EditorPanel: (props: object): null => {
      editorPanelProps.current = props;
      return null;
    },
    useI18n: () => ({ formatMessage: (): string => '' }),
  }),
);

const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} />
);

const IconButton = appLabEditorComponents.IconButton!;

describe('appLabEditorComponents.IconButton', () => {
  it('calls onPress without arguments', () => {
    const onPress = vi.fn();
    render(<IconButton label="Split view" Icon={Icon} onPress={onPress} />);

    fireEvent.click(screen.getByRole('button', { name: 'Split view' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith();
  });

  it('forwards the pressed state', () => {
    render(<IconButton label="Agent" Icon={Icon} isPressed />);

    expect(screen.getByRole('button', { name: 'Agent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('is disabled when isDisabled is set', () => {
    render(<IconButton label="Split view" Icon={Icon} isDisabled />);

    expect(screen.getByRole('button', { name: 'Split view' })).toBeDisabled();
  });

  it('renders the extra-small, tertiary, low-contrast App Lab button', () => {
    render(<IconButton label="Split view" Icon={Icon} />);

    expect(screen.getByRole('button', { name: 'Split view' })).toHaveClass(
      iconButtonStyles['x-small'],
      buttonStyles.tertiary,
      buttonStyles['low-contrast'],
    );
  });
});

describe('AppLabEditorPanel', () => {
  it('passes appLabEditorComponents to EditorPanel', () => {
    const logic = (() => ({
      openFiles: [{ fileId: 'main.py' }],
      readOnly: false,
      editorPanelLogic: vi.fn(),
      getKeywords: vi.fn(),
    })) as unknown as AppLabEditorPanelLogic;

    render(<AppLabEditorPanel appLabEditorLogic={logic} />);

    expect(editorPanelProps.current).toMatchObject({
      components: appLabEditorComponents,
    });
  });
});
