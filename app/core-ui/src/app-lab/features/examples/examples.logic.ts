import { getExamples } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { ExampleCatalogResult } from '@cloud-editor-mono/infrastructure';
import {
  ExampleSectionVM,
  ExamplesLogic,
  ExampleTableVM,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

import {
  BRICK_MACRO_SECTIONS,
  macroIdForCategory,
  OTHER_MACRO_ID,
  resolveCoreIcon,
} from './examples.mapping';
import { messages } from './messages';

const titleCase = (words: string[]): string =>
  words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// "01-led-blink" -> "Led Blink" (strip the NN- learning-path prefix)
export const prettifyCategoryName = (raw: string): string =>
  titleCase(raw.replace(/^\d+[-_.]/, '').split(/[-_]/));

// "arduino:air_quality_monitoring" -> "Air Quality Monitoring"
export const prettifyBrickName = (raw: string): string => {
  const name = raw.includes(':') ? raw.split(':').slice(1).join(':') : raw;
  return titleCase(name.split(/[-_]/));
};

interface SectionCopy {
  title: string;
  description: string;
}

export interface ExampleBuildLabels {
  core: SectionCopy;
  // localized copy per macro id (computer-vision, audio-sound, …)
  macros: Record<string, SectionCopy>;
  other: SectionCopy;
}

const sumCount = (tables: ExampleTableVM[]): number =>
  tables.reduce((n, t) => n + t.count, 0);

// Pure view-model builder — deterministic, unit-tested. Turns the endpoint
// shape (ExampleCatalogResult) into the VM.
export const buildExampleSections = (
  res: ExampleCatalogResult,
  labels: ExampleBuildLabels,
): ExampleSectionVM[] => {
  const sections: ExampleSectionVM[] = [];

  // Core and Foundational: one section, categories become tables.
  const core = res['core-and-foundational'] ?? [];
  if (core.length > 0) {
    const tables: ExampleTableVM[] = core.map((cat) => {
      const rows = (cat.examples ?? []).map((ex) => ({
        id: ex.encoded_id ?? ex.id,
        title: ex.name ?? ex.id,
        description: ex.description,
      }));
      return {
        id: cat.category ?? '',
        title: prettifyCategoryName(cat.category ?? ''),
        count: rows.length,
        icon: resolveCoreIcon(cat.category ?? ''),
        rows,
      };
    });
    sections.push({
      id: 'core-and-foundational',
      title: labels.core.title,
      description: labels.core.description,
      count: sumCount(tables),
      tables,
    });
  }

  // Bricks: the flat list is grouped by BE category into design macro-sections.
  const brickTablesByMacro = new Map<string, ExampleTableVM[]>();
  (res.bricks ?? []).forEach((br) => {
    const brickId = br.brick ?? '';
    const category = br.brick_category;
    const macroId = macroIdForCategory(category);
    const rows = (br.examples ?? []).map((ex) => ({
      id: ex.encoded_id ?? ex.id,
      title: ex.name ?? ex.id,
      description: ex.description,
    }));
    const table: ExampleTableVM = {
      id: brickId,
      title: prettifyBrickName(brickId),
      count: rows.length,
      icon: { kind: 'brick', category },
      rows,
    };
    const existing = brickTablesByMacro.get(macroId) ?? [];
    existing.push(table);
    brickTablesByMacro.set(macroId, existing);
  });

  // Emit macro-sections in the design order, skipping empty ones.
  BRICK_MACRO_SECTIONS.forEach((def) => {
    const tables = brickTablesByMacro.get(def.id);
    if (tables && tables.length > 0) {
      sections.push({
        id: def.id,
        title: labels.macros[def.id]?.title ?? def.id,
        description: labels.macros[def.id]?.description ?? '',
        count: sumCount(tables),
        tables,
      });
    }
  });

  // Any brick whose category didn't map to a macro-section lands here.
  const otherTables = brickTablesByMacro.get(OTHER_MACRO_ID);
  if (otherTables && otherTables.length > 0) {
    sections.push({
      id: OTHER_MACRO_ID,
      title: labels.other.title,
      description: labels.other.description,
      count: sumCount(otherTables),
      tables: otherTables,
    });
  }

  return sections;
};

// Factory (not a hook) returning the inner hook, matching createUseSettingsLogic.
export const createUseExamplesLogic = function (): ExamplesLogic {
  return function useExamplesLogic(): ReturnType<ExamplesLogic> {
    const navigate = useNavigate();
    const { formatMessage } = useI18n();

    // GET /v1/examples (arduino-app-cli). The response carries the brick
    // category used to group bricks into the design macro-sections.
    const { data, isLoading } = useQuery(['examples-catalog'], () =>
      getExamples(),
    );

    const labels: ExampleBuildLabels = useMemo(
      () => ({
        core: {
          title: formatMessage(messages.coreTitle),
          description: formatMessage(messages.coreDescription),
        },
        macros: {
          'computer-vision': {
            title: formatMessage(messages.computerVisionTitle),
            description: formatMessage(messages.computerVisionDescription),
          },
          'audio-sound': {
            title: formatMessage(messages.audioTitle),
            description: formatMessage(messages.audioDescription),
          },
          'language-text': {
            title: formatMessage(messages.languageTitle),
            description: formatMessage(messages.languageDescription),
          },
          connectivity: {
            title: formatMessage(messages.connectivityTitle),
            description: formatMessage(messages.connectivityDescription),
          },
          'user-interface': {
            title: formatMessage(messages.userInterfaceTitle),
            description: formatMessage(messages.userInterfaceDescription),
          },
        },
        other: {
          title: formatMessage(messages.otherTitle),
          description: formatMessage(messages.otherDescription),
        },
      }),
      [formatMessage],
    );

    const sections = useMemo(
      () => (data ? buildExampleSections(data, labels) : []),
      [data, labels],
    );

    const onSelectExample = useCallback(
      (encodedId: string): void => {
        navigate({ to: '/examples/$appId', params: { appId: encodedId } });
      },
      [navigate],
    );

    return { sections, isLoading, onSelectExample };
  };
};
