import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatInput } from './ChatInput';

// jsdom has no layout engine; the textarea auto-grow uses ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);

const renderInput = (
  onAddProvider?: VoidFunction,
): { setModel: ReturnType<typeof vi.fn> } => {
  const setModel = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatInput
      isStreaming={false}
      canCompose
      onSend={vi.fn()}
      onStop={vi.fn()}
      models={[
        { id: 'opencode/big-pickle', name: 'Big Pickle' },
        { id: 'opencode/space-bunny', name: 'Space Bunny' },
      ]}
      currentModelId="opencode/big-pickle"
      setModel={setModel}
      modes={[]}
      setMode={vi.fn()}
      onAddProvider={onAddProvider}
    />,
  );
  return { setModel };
};

describe('ChatInput model menu', () => {
  it('ends with a row that opens the provider settings', () => {
    const onAddProvider = vi.fn();
    const { setModel } = renderInput(onAddProvider);

    fireEvent.click(screen.getByRole('button', { name: 'Model' }));
    expect(screen.getByText('Opens Settings')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add provider'));

    expect(onAddProvider).toHaveBeenCalledTimes(1);
    expect(setModel).not.toHaveBeenCalled();
  });

  it('has no such row without a way to open the settings', () => {
    renderInput();

    fireEvent.click(screen.getByRole('button', { name: 'Model' }));

    expect(screen.getByText('Space Bunny')).toBeInTheDocument();
    expect(screen.queryByText('Add provider')).toBeNull();
  });
});

// In the engine's alphabetical order, with the provider in the name as the engine sends it.
const freeModels = [
  { id: 'opencode/beam-free', name: 'OpenCode/Beam Free', free: true },
  { id: 'opencode/big-pickle', name: 'OpenCode/Big Pickle', free: true },
  { id: 'opencode/grok-code', name: 'OpenCode/Grok Code', free: true },
  {
    id: 'opencode/mimo-v2.6-flash-free',
    name: 'OpenCode/MiMo Flash',
    free: true,
  },
  {
    id: 'opencode/nemotron-3-ultra-free',
    name: 'OpenCode/Nemotron Ultra',
    free: true,
  },
  {
    id: 'opencode/space-bunny-free',
    name: 'OpenCode/Space Bunny',
    free: true,
  },
];

const renderGrouped = (
  models: { id: string; name: string; free?: boolean }[],
  currentModelId = models[0].id,
): { setModel: ReturnType<typeof vi.fn> } => {
  const setModel = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatInput
      isStreaming={false}
      canCompose
      onSend={vi.fn()}
      onStop={vi.fn()}
      models={models}
      currentModelId={currentModelId}
      setModel={setModel}
      modes={[]}
      setMode={vi.fn()}
      onAddProvider={vi.fn()}
      providerNames={{ anthropic: 'Anthropic' }}
      freeModelsLabel="OpenCode free models"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Model' }));
  return { setModel };
};

describe('ChatInput model menu by provider', () => {
  it('lists every free model on the first level, with no Other models, when no provider is connected', () => {
    renderGrouped(freeModels);

    const menu = within(screen.getByRole('listbox'));
    expect(
      menu.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'Beam Free',
      'Big Pickle',
      'Grok Code',
      'MiMo Flash',
      'Nemotron Ultra',
      'Space Bunny',
      'Add providerOpens Settings',
    ]);
    expect(screen.queryByText('Other models')).toBeNull();
  });

  it('lists the connected providers under their names and every free model behind Other models', () => {
    const { setModel } = renderGrouped([
      { id: 'anthropic/claude-sonnet', name: 'Anthropic/Claude Sonnet' },
      ...freeModels,
    ]);

    const menu = within(screen.getByRole('listbox'));
    expect(menu.getByText('Anthropic')).toBeInTheDocument();
    expect(menu.getByText('Claude Sonnet')).toBeInTheDocument();
    expect(screen.queryByText('Big Pickle')).toBeNull();

    fireEvent.click(screen.getByText('Other models'));

    const otherModels = within(
      screen.getByRole('listbox', { name: 'Other models' }),
    );
    expect(otherModels.getByText('OpenCode free models')).toBeInTheDocument();
    expect(otherModels.getByText('Big Pickle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Grok Code'));

    expect(setModel).toHaveBeenCalledWith('opencode/grok-code');
  });

  it('keeps Add provider as the last row', () => {
    renderGrouped(freeModels);

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[options.length - 1]).toHaveTextContent('Add provider');
  });

  // Only the engine's own flag makes a model free: a paid model of the same provider is listed with the paid ones.
  it('groups a paid model of the engine provider by itself, named without the provider', () => {
    renderGrouped([
      { id: 'opencode/claude-opus-5', name: 'OpenCode/Claude Opus 5' },
      { id: 'github-copilot/gpt-5', name: 'GitHub Copilot/GPT-5' },
      ...freeModels,
    ]);

    const menu = within(screen.getByRole('listbox'));
    expect(menu.getByText('OpenCode')).toBeInTheDocument();
    expect(menu.getByText('Claude Opus 5')).toBeInTheDocument();
    expect(menu.getByText('GitHub Copilot')).toBeInTheDocument();
    expect(menu.getByText('GPT-5')).toBeInTheDocument();
    expect(menu.queryByText('Big Pickle')).toBeNull();
    expect(menu.getByText('Other models')).toBeInTheDocument();
  });

  it('marks Other models when the selected model is behind it', () => {
    renderGrouped(
      [
        { id: 'anthropic/claude-sonnet', name: 'Anthropic/Claude Sonnet' },
        ...freeModels,
      ],
      'opencode/grok-code',
    );

    const otherModels = screen.getByRole('button', { name: 'Other models' });
    expect(otherModels.closest('li')).toHaveAttribute('aria-selected', 'true');
  });

  // Portaled to the body, the second level is out of the tab order: the keys move focus into it and back.
  it('moves through the second level with the keyboard and back to its row', () => {
    renderGrouped([
      { id: 'anthropic/claude-sonnet', name: 'Anthropic/Claude Sonnet' },
      ...freeModels,
    ]);
    const otherModels = screen.getByRole('button', { name: 'Other models' });
    otherModels.focus();

    fireEvent.keyDown(otherModels, { key: 'ArrowRight' });
    const second = within(
      screen.getByRole('listbox', { name: 'Other models' }),
    );
    expect(document.activeElement).toBe(
      second.getByRole('button', { name: 'Beam Free' }),
    );

    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(
      second.getByRole('button', { name: 'Big Pickle' }),
    );

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Other models' })).toBeNull();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(document.activeElement).toBe(otherModels);

    fireEvent.keyDown(otherModels, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
    expect(screen.queryByRole('listbox', { name: 'Other models' })).toBeNull();
    expect(document.activeElement).toBe(otherModels);
  });

  it('puts focus back in the composer after a pick from the second level', () => {
    const { setModel } = renderGrouped([
      { id: 'anthropic/claude-sonnet', name: 'Anthropic/Claude Sonnet' },
      ...freeModels,
    ]);

    fireEvent.click(screen.getByText('Other models'));
    fireEvent.click(screen.getByText('Grok Code'));

    expect(setModel).toHaveBeenCalledWith('opencode/grok-code');
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});

// Until the session says which model it is on, no model is named, and the toolbar keeps its layout.
describe('ChatInput model selector before the model is known', () => {
  it('stays in place, disabled, with no model named', () => {
    render(
      <ChatInput
        isStreaming={false}
        canCompose
        onSend={vi.fn()}
        onStop={vi.fn()}
        models={[
          { id: 'opus', name: 'Opus 5' },
          { id: 'fable', name: 'Fable 5' },
        ]}
        setModel={vi.fn()}
        modes={[{ id: 'build', name: 'Build' }]}
        currentModeId="build"
        setMode={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Model' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('Model');
    expect(screen.queryByText('Opus 5')).toBeNull();
  });

  it('opens with no model named when the session could not report its own', () => {
    render(
      <ChatInput
        isStreaming={false}
        canCompose
        onSend={vi.fn()}
        onStop={vi.fn()}
        models={[{ id: 'opus', name: 'Opus 5' }]}
        modelUnreadable
        setModel={vi.fn()}
        modes={[]}
        setMode={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Model' });
    expect(trigger).toBeEnabled();
    fireEvent.click(trigger);
    expect(screen.getByText('Opus 5')).toBeInTheDocument();
  });
});

describe('ChatInput mode menu', () => {
  it('capitalises mode names the agent sends in lower case', () => {
    render(
      <ChatInput
        isStreaming={false}
        canCompose
        onSend={vi.fn()}
        onStop={vi.fn()}
        models={[]}
        setModel={vi.fn()}
        modes={[
          { id: 'build', name: 'build' },
          { id: 'plan', name: 'plan' },
        ]}
        currentModeId="build"
        setMode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mode' }));

    expect(screen.getAllByText('Build').length).toBeGreaterThan(0);
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.queryByText('build')).toBeNull();
  });
});
