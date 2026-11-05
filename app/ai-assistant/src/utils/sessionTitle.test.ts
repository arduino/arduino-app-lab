import { describe, expect, it } from 'vitest';

import { titleIfNamed } from './sessionTitle';

describe('titleIfNamed', () => {
  // OpenCode names a session on creation and replaces that with a summary once it has been prompted.
  it('drops the name the engine gives an unprompted session', () => {
    expect(
      titleIfNamed('New session - 2026-09-16T10:11:07.172Z'),
    ).toBeUndefined();
    expect(titleIfNamed('2026-09-16T10:11:07Z')).toBeUndefined();
  });

  // A title the model wrote is the real one and must survive untouched, even when it ends in digits.
  it('keeps a written title', () => {
    for (const title of [
      'Blink an LED on D13',
      'Quick network check',
      'Port 8000 conflict',
    ]) {
      expect(titleIfNamed(title)).toBe(title);
    }
  });

  it('has nothing to show for an absent or empty title', () => {
    expect(titleIfNamed(undefined)).toBeUndefined();
    expect(titleIfNamed('')).toBeUndefined();
  });

  // The engines spell the same stamp differently, and the Z is optional in what OpenCode writes.
  it('drops the placeholder however the stamp is spelled', () => {
    for (const title of [
      'New session - 2026-09-16T10:11:07.172Z',
      'New session - 2026-09-16T10:11:07Z',
      'New session - 2026-09-16T10:11:07.172',
      'New session - 2026-09-16T10:11:07',
      '2026-09-16T10:11:07.000000Z',
    ]) {
      expect(titleIfNamed(title)).toBeUndefined();
    }
  });

  // Only the engine's own label marks the placeholder: a title the user typed can end in a timestamp too.
  it('keeps a title of the user that ends in a timestamp', () => {
    for (const title of [
      'Notes - 2026-10-20T10:00:00',
      'Choose LED color preferenceNotes - 2026-10-20T10:00:00',
      'Build log - 2026-09-16T10:11:07.172Z',
    ]) {
      expect(titleIfNamed(title)).toBe(title);
    }
  });

  // A small model can write its reasoning into the title, with or without the opening tag.
  it('keeps only what follows the reasoning a model left in the title', () => {
    expect(titleIfNamed('Greeting and hello</think>Hello there!')).toBe(
      'Hello there!',
    );
    expect(titleIfNamed('<think>the user wants a blink</think>Blink D13')).toBe(
      'Blink D13',
    );
    expect(titleIfNamed('Blink D13 <think>still thinking')).toBe('Blink D13');
    expect(titleIfNamed('<think>nothing else</think>')).toBeUndefined();
  });

  // A written title is the only one the sidebar has; dropping one reads as a session with no name.
  it('keeps a title that merely ends in digits or a date', () => {
    for (const title of [
      'Blink an LED at 2026 Hz',
      'Port 8000 conflict on 2026-09-16',
      'Sketch v2.1.7',
      'Roadmap 2026',
      'Error at 2026-09-16T10:11:07Z in the log', // the stamp is not at the end
      'My own name for this chat', // the user renamed it
    ]) {
      expect(titleIfNamed(title)).toBe(title);
    }
  });
});
