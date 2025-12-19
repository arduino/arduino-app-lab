import {
  AssistantContent_GenAiApi,
  GeneratedSketch_GenAiApi,
  HumanContent_GenAiApi,
  SketchPlan_GenAiApi,
} from '@cloud-editor-mono/infrastructure';

import { GenAIConversation } from '../../../sidenav.type';

export function isHumanContent(
  content?: HumanContent_GenAiApi | AssistantContent_GenAiApi,
): content is HumanContent_GenAiApi {
  return (content as HumanContent_GenAiApi).text !== undefined;
}

export function isAssistantContent(
  content?: HumanContent_GenAiApi | AssistantContent_GenAiApi,
): content is AssistantContent_GenAiApi {
  return (
    Array.isArray(content) &&
    content.every((c) => c.data !== undefined && c.type !== undefined)
  );
}

export function isSketchPlanContent(
  content?: string | SketchPlan_GenAiApi | GeneratedSketch_GenAiApi,
): content is SketchPlan_GenAiApi {
  return (
    (content as SketchPlan_GenAiApi).components !== undefined &&
    (content as SketchPlan_GenAiApi).libraries !== undefined &&
    (content as SketchPlan_GenAiApi).codeInstructions !== undefined
  );
}

export function isGeneratedSketchContent(
  content?: string | SketchPlan_GenAiApi | GeneratedSketch_GenAiApi,
): content is GeneratedSketch_GenAiApi {
  return (
    (content as GeneratedSketch_GenAiApi).code !== undefined &&
    (content as GeneratedSketch_GenAiApi).introduction !== undefined &&
    (content as GeneratedSketch_GenAiApi).name !== undefined
  );
}

export const chatHistoryToString = (
  conversation: GenAIConversation,
): string => {
  return conversation
    .map((message) => {
      let content = `${message.senderDisplayName}:\n`;
      if (isHumanContent(message.data)) {
        content += message.data.text;
      }
      if (isAssistantContent(message.data)) {
        return (content += message.data
          .map((c) =>
            isSketchPlanContent(c.data)
              ? c.data.codeInstructions.join('/')
              : isGeneratedSketchContent(c.data)
              ? c.data.code
              : c.data,
          )
          .join('\n'));
      }
      return content;
    })
    .join('\n\n');
};

export function parseUnifiedDiff(block: string): {
  fileName: string;
  original: string;
  modified: string;
  changes: string;
  noChanges: string;
  updatedBlock: string;
  startingLine: number;
  endingLine: number;
} {
  let fileName = '';
  const lines = block.split('\n');
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];
  const changes: string[] = [];
  const noChanges: string[] = [];
  let originalStartingLine: number = 1;
  let modifiedStartingLine: number = 1;

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      fileName = line.slice(6).split('/').pop() ?? '';
    } else if (line.startsWith('@@')) {
      const [, original, modified] = line.split(' ');
      originalStartingLine = original
        ? Number(original.slice(1).split(',')[0])
        : originalStartingLine;
      modifiedStartingLine = modified
        ? Number(modified.slice(1).split(',')[0])
        : modifiedStartingLine;
    } else if (line.startsWith('-')) {
      originalLines.push(line);
      noChanges.push(line.slice(1));
    } else if (line.startsWith('+')) {
      modifiedLines.push(line);
      changes.push(line.slice(1));
    } else {
      originalLines.push(line);
      modifiedLines.push(line);
      changes.push(line.slice(1));
      noChanges.push(line.slice(1));
    }
  }

  const newHeader = `@@ -${originalStartingLine},${noChanges.length} +${modifiedStartingLine},${changes.length} @@`;

  return {
    fileName,
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n'),
    changes: changes.join('\n'),
    noChanges: noChanges.join('\n'),
    updatedBlock: [newHeader, ...lines.slice(3)].join('\n'),
    startingLine: originalStartingLine,
    endingLine: originalStartingLine + changes.length - 1,
  };
}

export function splitDiff(diff: string): {
  blocks: string[];
} {
  const lines = diff.split('\n');

  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.startsWith('---')) {
      if (currentBlock.length) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    }
    currentBlock.push(line);
  }

  blocks.push(currentBlock.join('\n'));

  return { blocks };
}
