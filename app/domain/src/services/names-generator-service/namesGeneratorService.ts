import { Config, names, uniqueNamesGenerator } from 'unique-names-generator';

export function createNamesGenerator(): { generateName: () => string } {
  const config: Config = {
    dictionaries: [names],
    length: 1,
    style: 'lowerCase',
  };

  return {
    generateName: (): string => uniqueNamesGenerator(config),
  };
}
