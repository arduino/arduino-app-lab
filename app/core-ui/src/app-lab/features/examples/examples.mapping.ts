import { ExampleTableIcon } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

// FE grouping/icon config. Titles + descriptions come from the design (messages);
// membership below maps a brick's BE `category` to a design macro-section.

export const OTHER_MACRO_ID = 'other';

export interface MacroSectionDef {
  id: string;
  categories: string[];
}

// Ordered exactly as the design lays the sections out. Any category not listed
// here (miscellaneous, or an empty/absent category) falls into the Other section.
export const BRICK_MACRO_SECTIONS: MacroSectionDef[] = [
  { id: 'computer-vision', categories: ['image', 'video'] },
  { id: 'audio-sound', categories: ['audio'] },
  { id: 'language-text', categories: ['text'] },
  { id: 'connectivity', categories: ['storage'] },
  { id: 'user-interface', categories: ['ui'] },
];

// category token -> macro id (built from BRICK_MACRO_SECTIONS)
const CATEGORY_TO_MACRO: Record<string, string> = BRICK_MACRO_SECTIONS.reduce(
  (acc, def) => {
    def.categories.forEach((c) => {
      acc[c] = def.id;
    });
    return acc;
  },
  {} as Record<string, string>,
);

export const macroIdForCategory = (category?: string): string =>
  (category && CATEGORY_TO_MACRO[category.toLowerCase()]) || OTHER_MACRO_ID;

// Core & Foundational category emoji (all design-approved), keyed by the slug after the NN- prefix.
const CORE_CATEGORY_EMOJI: Record<string, string> = {
  'led-blink': '🔴', // red circle (emoji_u1f534)
  'bridge-basics': '🔤', // abc (emoji_u1f524)
  'apps-basics': '⚛️', // atom (emoji_u269b)
  'app-basics': '⚛️', // atom — alias; the BE slug has appeared as both singular and plural
  'led-matrix': '🔲', // square button — LED grid (emoji_u1f532)
  logging: '📋', // clipboard (emoji_u1f4cb)
  'camera-basics': '📷', // camera (emoji_u1f4f7)
  'microphone-basics': '🎤', // microphone (emoji_u1f3a4)
  'web-ui-basics': '🌐', // globe (emoji_u1f310)
  'computer-vision': '👀', // eyes (emoji_u1f440)
};

const DEFAULT_CORE_EMOJI = '⚪';

// "01-led-blink" -> "led-blink"
const coreSlug = (category: string): string =>
  category.replace(/^\d+[-_.]/, '').toLowerCase();

export const resolveCoreIcon = (category: string): ExampleTableIcon => ({
  kind: 'emoji',
  value: CORE_CATEGORY_EMOJI[coreSlug(category)] ?? DEFAULT_CORE_EMOJI,
});
