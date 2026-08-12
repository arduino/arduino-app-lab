import { ExampleCatalogResult } from '@cloud-editor-mono/infrastructure';
import { describe, expect, it } from 'vitest';

import {
  buildExampleSections,
  ExampleBuildLabels,
  prettifyBrickName,
  prettifyCategoryName,
} from './examples.logic';

const labels: ExampleBuildLabels = {
  core: { title: 'Core and foundational', description: 'core desc' },
  macros: {
    'computer-vision': { title: 'AI · Computer Vision', description: 'cv' },
    'audio-sound': { title: 'AI · Audio & Sound', description: 'audio' },
    'language-text': { title: 'AI · Language & Text', description: 'lang' },
    connectivity: { title: 'Connectivity, Cloud & Data', description: 'conn' },
    'user-interface': { title: 'User Interface', description: 'ui' },
  },
  other: { title: 'Other', description: 'other' },
};

describe('prettifyCategoryName', () => {
  it('strips the NN- learning-path prefix and title-cases', () => {
    expect(prettifyCategoryName('01-led-blink')).toBe('Led Blink');
    expect(prettifyCategoryName('02-led-matrix')).toBe('Led Matrix');
    expect(prettifyCategoryName('03-bridge')).toBe('Bridge');
  });
});

describe('prettifyBrickName', () => {
  it('drops the namespace and title-cases the brick name', () => {
    expect(prettifyBrickName('arduino:air_quality_monitoring')).toBe(
      'Air Quality Monitoring',
    );
    expect(prettifyBrickName('arduino:llm')).toBe('Llm');
    expect(prettifyBrickName('object_detection')).toBe('Object Detection');
  });
});

describe('buildExampleSections', () => {
  const res: ExampleCatalogResult = {
    'core-and-foundational': [
      {
        category: '01-led-blink',
        examples: [
          {
            id: 'examples:core-and-foundational/01-led-blink/01-a',
            encoded_id: 'enc-a',
            name: 'A',
            description: 'desc a',
          },
          {
            id: 'examples:core-and-foundational/01-led-blink/02-b',
            encoded_id: 'enc-b',
            name: 'B',
          },
        ],
      },
    ],
    bricks: [
      {
        brick: 'arduino:object_detection',
        brick_category: 'image',
        examples: [{ id: 'x', encoded_id: 'enc-od', name: 'Detect' }],
      },
      {
        brick: 'arduino:llm',
        brick_category: 'text',
        examples: [{ id: 'y', encoded_id: 'enc-llm', name: 'Chat' }],
      },
      {
        brick: 'arduino:air_quality_monitoring',
        brick_category: 'miscellaneous',
        examples: [{ id: 'z', encoded_id: 'enc-aq', name: 'By city' }],
      },
    ],
  };

  it('emits Core first, then brick macro-sections in design order, skipping empty ones', () => {
    const sections = buildExampleSections(res, labels);
    expect(sections.map((s) => s.id)).toEqual([
      'core-and-foundational',
      'computer-vision', // object_detection (image)
      'language-text', // llm (text)
      'other', // air_quality_monitoring (miscellaneous -> Other)
    ]);
    expect(sections[0].title).toBe('Core and foundational');
    expect(sections[0].count).toBe(2);
    expect(sections[0].tables[0].title).toBe('Led Blink');
    expect(sections[0].tables[0].icon).toEqual({ kind: 'emoji', value: '🔴' });
  });

  it('renders each brick as a table with a brick icon carrying its category', () => {
    const sections = buildExampleSections(res, labels);
    const cv = sections.find((s) => s.id === 'computer-vision');
    expect(cv?.tables[0].title).toBe('Object Detection');
    expect(cv?.tables[0].icon).toEqual({ kind: 'brick', category: 'image' });
  });

  it('groups a brick by its category', () => {
    const sections = buildExampleSections(
      {
        bricks: [
          {
            brick: 'arduino:object_detection',
            brick_category: 'audio',
            examples: [{ id: 'x', encoded_id: 'enc-od', name: 'Detect' }],
          },
        ],
      },
      labels,
    );
    // object_detection groups under audio-sound, not computer-vision
    expect(sections.find((s) => s.id === 'computer-vision')).toBeUndefined();
    const audio = sections.find((s) => s.id === 'audio-sound');
    expect(audio?.tables[0].title).toBe('Object Detection');
  });

  it('groups storage bricks into the Connectivity section', () => {
    const sections = buildExampleSections(
      {
        bricks: [
          {
            brick: 'arduino:dbstorage_sqlstore',
            brick_category: 'storage',
            examples: [{ id: 's' }],
          },
        ],
      },
      labels,
    );
    expect(sections.map((s) => s.id)).toEqual(['connectivity']);
  });

  it('buckets bricks with an unknown category into the Other section', () => {
    const sections = buildExampleSections(
      { bricks: [{ brick: 'acme:mystery', examples: [{ id: 'm' }] }] },
      labels,
    );
    expect(sections.map((s) => s.id)).toEqual(['other']);
    expect(sections[0].title).toBe('Other');
  });

  it('maps rows using encoded_id and falls back to id/name', () => {
    const sections = buildExampleSections(res, labels);
    const rows = sections[0].tables[0].rows;
    expect(rows[0]).toEqual({ id: 'enc-a', title: 'A', description: 'desc a' });
    expect(rows[1].description).toBeUndefined();
  });

  it('returns nothing when both roots are empty', () => {
    expect(buildExampleSections({ bricks: [] }, labels)).toEqual([]);
    expect(
      buildExampleSections({ 'core-and-foundational': [] }, labels),
    ).toEqual([]);
  });
});
