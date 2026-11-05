import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';

import { describeError } from './describeError';

const { formatMessage } = createIntl({ locale: 'en' });

const refusal = (fields: object): string =>
  JSON.stringify({ message: 'cannot switch agent yet', ...fields });

describe('describeError', () => {
  // Trying again cannot clear a conflict; a new checkout of the app can.
  it('words a switch refused over conflicting edits, naming only the apps in conflict', () => {
    expect(
      describeError(
        refusal({
          code: 'agent_switch_conflicting_edits',
          apps: ['Blink', 'Weather Station'],
          conflictingApps: ['Blink'],
        }),
        formatMessage,
      ),
    ).toBe(
      "Can't switch the agent yet: the agent's edits to Blink conflict with changes made on the board since its checkout, so they are not on the board. Ask the agent to check out Blink again, then apply its edits again or drop them. Then switch. The edits to Weather Station could not be saved to the board either: check the board connection.",
    );
  });

  it('words a refusal whose apps are all in conflict with no other sentence', () => {
    expect(
      describeError(
        refusal({
          code: 'agent_switch_conflicting_edits',
          apps: ['Blink', 'Weather Station'],
          conflictingApps: ['Blink', 'Weather Station'],
        }),
        formatMessage,
      ),
    ).toBe(
      "Can't switch the agent yet: the agent's edits to Blink, Weather Station conflict with changes made on the board since its checkout, so they are not on the board. Ask the agent to check out Blink, Weather Station again, then apply its edits again or drop them. Then switch.",
    );
  });

  // An older backend sends one list, which can also hold apps whose save failed for another reason.
  it('words a list it cannot split so it holds for every app in it', () => {
    expect(
      describeError(
        refusal({
          code: 'agent_switch_conflicting_edits',
          apps: ['Blink', 'Weather Station'],
        }),
        formatMessage,
      ),
    ).toBe(
      "Can't switch the agent yet: the agent's edits to Blink, Weather Station are not on the board. Where they conflict with changes made on the board since its checkout, ask the agent to check out the app again, then apply its edits again or drop them. Where they could not be saved, check the board connection. Then switch.",
    );
    expect(
      describeError(
        refusal({ code: 'agent_switch_conflicting_edits', apps: ['Blink'] }),
        formatMessage,
      ),
    ).toMatch(
      /^Can't switch the agent yet: the agent's edits to Blink conflict/,
    );
  });

  it('says when the agent in use could not start again after the refusal', () => {
    expect(
      describeError(
        refusal({
          code: 'agent_switch_conflicting_edits',
          apps: ['Blink'],
          restartFailed: true,
        }),
        formatMessage,
      ),
    ).toMatch(
      /check out Blink again.*The agent you were using could not start again/,
    );
  });

  it("keeps Go's message for a conflict that names no app", () => {
    expect(
      describeError(
        refusal({ code: 'agent_switch_conflicting_edits' }),
        formatMessage,
      ),
    ).toBe('cannot switch agent yet');
  });

  it('words a provider key the provider refused', () => {
    expect(
      describeError(
        JSON.stringify({
          code: 'provider_key_rejected',
          message:
            'Google Gemini rejected that API key — check you copied it in full from its console',
          provider: 'Google Gemini',
        }),
        formatMessage,
      ),
    ).toBe(
      'Google Gemini did not accept this API key. Check that you copied the whole key from your Google Gemini account.',
    );
  });

  it("quotes the provider's own answer when it gave one", () => {
    expect(
      describeError(
        JSON.stringify({
          code: 'provider_key_rejected',
          message:
            'Anthropic rejected that API key — check you copied it in full from its console',
          provider: 'Anthropic',
          reason: 'invalid x-api-key',
        }),
        formatMessage,
      ),
    ).toBe(
      'Anthropic did not accept this API key and answered: "invalid x-api-key". Check that you copied the whole key from your Anthropic account.',
    );
  });

  it('says what is wrong with a pasted text before anything was sent', () => {
    const paste = (code: string): string =>
      describeError(
        JSON.stringify({
          code,
          message: 'the pasted text is not a key',
          provider: 'Anthropic',
          prefix: 'sk-ant-',
        }),
        formatMessage,
      );
    expect(paste('provider_key_has_spaces')).toBe(
      'The key has a space or a line break inside. Copy it again as one line, with nothing around it.',
    );
    expect(paste('provider_key_text_before')).toBe(
      'The text you pasted has something before the key. Paste only the key: it starts with "sk-ant-".',
    );
    expect(paste('provider_key_repeated')).toBe(
      'The text you pasted holds the key more than once. Paste it only once.',
    );
  });

  // Recognized by how the key starts, so nothing was sent to the provider picked.
  it('words a key pasted under the wrong provider, naming both', () => {
    expect(
      describeError(
        JSON.stringify({
          code: 'provider_key_for_another_provider',
          message: 'that key is for Anthropic, not Google Gemini',
          provider: 'Google Gemini',
          keyProvider: 'Anthropic',
        }),
        formatMessage,
      ),
    ).toBe(
      'This key is for Anthropic, not Google Gemini. Paste your Google Gemini API key here, or add this one under Anthropic.',
    );
  });

  it("keeps Go's message for a key refusal that names no provider", () => {
    expect(
      describeError(
        JSON.stringify({
          code: 'provider_key_for_another_provider',
          message: 'that key is for another provider',
        }),
        formatMessage,
      ),
    ).toBe('that key is for another provider');
  });
});
