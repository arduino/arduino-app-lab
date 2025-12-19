const colorsJson = require('../themes/colors.json');
const { exec } = require('child_process');

colorsJson.themes.map((theme) => {
  const setsToUse = Object.keys(theme.selectedTokenSets);
  const excludedSets = Object.keys(theme.selectedTokenSets).filter((set) => {
    return (
      theme.selectedTokenSets[set] === 'source' && !set.includes('2_Contextual')
    );
  });

  const themeName =
    theme.name === 'Default' ? 'light' : theme.name.toLowerCase();

  exec(
    `token-transformer ./themes/colors.json ./themes/_${themeName}-theme.json ${setsToUse.join(
      ',',
    )} ${excludedSets.join(',')}`,
  );
});
