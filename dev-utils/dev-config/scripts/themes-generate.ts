const StyleDictionaryPkg = require('style-dictionary');

const themes = ['light-theme', 'dark-theme'];

StyleDictionaryPkg.registerFormat({
  name: 'css/variables-custom',
  formatter: function (dictionary) {
    return `${dictionary.allProperties
      .map((prop) => `$${prop.name}: --${prop.name};`)
      .join('\n')}
`;
  },
});

StyleDictionaryPkg.registerFormat({
  name: 'exported-variables',
  formatter: function (dictionary) {
    return `@use "../public/functions.scss";

:export {
${dictionary.allProperties
  .map(
    (prop) =>
      `  ${prop.name.replace(/-./g, (x) =>
        x[1].toUpperCase(),
      )}: functions.theme-var(--${prop.name});`,
  )
  .join('\n')}
}
`;
  },
});

StyleDictionaryPkg.registerFormat({
  name: 'map-custom',
  formatter: function (dictionary) {
    return `@use "variables";

$${this.mapName}: (
${dictionary.allProperties
  .map((prop) => `  variables.$${prop.name}: ${prop.value},`)
  .join('\n')}
);
`;
  },
});

function getVariablesConfig(theme: string) {
  return {
    source: [`./themes/_${theme}.json`],
    platforms: {
      scss: {
        transforms: ['attribute/cti', 'name/cti/kebab'],
        buildPath: `../../ui-packages/ui-components/themes/`,
        files: [
          {
            destination: `_variables.scss`,
            format: 'css/variables-custom',
          },
        ],
      },
    },
  };
}

const styleDictionaryVars = StyleDictionaryPkg.extend(
  getVariablesConfig(themes[0]),
);
styleDictionaryVars.buildPlatform('scss');

function getExportedVariablesConfig(theme: string) {
  return {
    source: [`./themes/_${theme}.json`],
    platforms: {
      scss: {
        transforms: ['attribute/cti', 'name/cti/kebab'],
        buildPath: `../../ui-packages/ui-components/themes/`,
        files: [
          {
            destination: `_exported-variables.scss`,
            format: 'exported-variables',
          },
        ],
      },
    },
  };
}

const styleDictionaryExportedVars = StyleDictionaryPkg.extend(
  getExportedVariablesConfig(themes[0]),
);
styleDictionaryExportedVars.buildPlatform('scss');

function getThemesConfig(theme: string) {
  return {
    source: [`./themes/_${theme}.json`],
    platforms: {
      scss: {
        transforms: ['attribute/cti', 'name/cti/kebab'],
        buildPath: `../../ui-packages/ui-components/themes/`,
        files: [
          {
            destination: `_${theme}.scss`,
            format: 'map-custom',
            mapName: `map-${theme}`,
          },
        ],
      },
    },
  };
}

themes.map((theme) => {
  const styleDictionary = StyleDictionaryPkg.extend(getThemesConfig(theme));

  styleDictionary.buildPlatform('scss');
});
