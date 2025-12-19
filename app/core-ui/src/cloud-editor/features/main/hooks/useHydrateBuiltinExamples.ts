import {
  BuiltinExampleFile,
  BuiltinExampleListResponse,
  getBuiltinExampleDetailRequest,
} from '@bcmi-labs/cloud-editor-infrastructure';
import { pickMainIno } from '@cloud-editor-mono/common';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { BUILTIN_EXAMPLES_QUERY_KEY } from './examples';

type HydratableItem = {
  path?: string;
  files?: BuiltinExampleFile[];
  ino?: BuiltinExampleFile;
  folder?: string;
  types?: string[];
};

type HydratableList = BuiltinExampleListResponse | HydratableItem[];

interface UseHydrateBuiltinExamplesOptions {
  skipIfHasFiles?: boolean;
  setTypesBuiltin?: boolean;
}

export const useHydrateBuiltinExamples = (
  options: UseHydrateBuiltinExamplesOptions = {},
): { hydrateByPaths: (paths: string[]) => Promise<void> } => {
  const qc = useQueryClient();

  const hydrateByPaths = useCallback(
    async (paths: string[]): Promise<void> => {
      const leaves = Array.from(new Set(paths.filter(Boolean)));
      if (!leaves.length) return;

      const results = await Promise.allSettled(
        leaves.map((path) => getBuiltinExampleDetailRequest(path)),
      );

      qc.setQueryData<HydratableList>(BUILTIN_EXAMPLES_QUERY_KEY, (prev) => {
        if (!prev) return prev;

        const mergeList = (list: HydratableItem[]): HydratableItem[] =>
          list.map((item) => {
            const i = leaves.findIndex((p) => p === item.path);
            if (i === -1) return item;
            if (options.skipIfHasFiles && item.files && item.files.length) {
              return item;
            }

            const r = results[i];
            if (r.status !== 'fulfilled') return item;

            const raw = (r.value ?? []) as BuiltinExampleFile[];
            if (!raw.length) return item;

            const norm = raw.map((f) => ({
              ...f,
              path: `${item.path}/${f.name}`,
            }));

            const ino = pickMainIno(norm);
            const files = ino ? norm.filter((f) => f.name !== ino.name) : norm;

            const folder = item.path?.split('/')?.[0] || '';

            return {
              ...item,
              files,
              ...(ino ? { ino } : {}),
              folder,
              ...(options.setTypesBuiltin ? { types: ['builtin'] } : {}),
            };
          });

        if (Array.isArray(prev)) {
          return mergeList(prev as HydratableItem[]);
        }

        if ('examples' in prev) {
          return {
            ...prev,
            examples: mergeList(
              (prev as BuiltinExampleListResponse).examples as HydratableItem[],
            ),
          } as BuiltinExampleListResponse;
        }

        return prev;
      });
    },
    [options.setTypesBuiltin, options.skipIfHasFiles, qc],
  );

  return { hydrateByPaths };
};
