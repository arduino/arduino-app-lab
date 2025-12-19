require('dotenv').config({ path: './themes/.figma.env' });

const Figma = require('figma-api');
const fs = require('fs');

// Environment variables
const FIGMA_API_ACCESS_TOKEN = process.env.FIGMA_API_ACCESS_TOKEN!;
const FIGMA_THEME_FILE_ID = process.env.FIGMA_THEME_FILE_ID!;

// Figma Tokens plugin ID
const FIGMA_TOKENS_PLUGIN_DATA = '843461159747178978';

const main = async (): Promise<void> => {
  const api = new Figma.Api({
    personalAccessToken: FIGMA_API_ACCESS_TOKEN,
  });

  const {
    document: {
      sharedPluginData: { tokens },
    },
  } = await api.getFile(FIGMA_THEME_FILE_ID, {
    plugin_data: `${FIGMA_TOKENS_PLUGIN_DATA},shared`,
  });

  const colors = {
    ...JSON.parse(tokens.values),
    themes: JSON.parse(tokens.themes),
  };

  // Write colors in the corresponding json file
  fs.writeFile(
    './themes/colors.json',
    JSON.stringify(
      colors,
      (key, val) => (key === 'oldValue' ? undefined : val), // oldValue not recognized by style-dictionary
    ),
    (err) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log('Colors file saved!');
    },
  );
};

main();
