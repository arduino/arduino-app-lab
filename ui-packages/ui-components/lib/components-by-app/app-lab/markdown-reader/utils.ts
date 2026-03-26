export function mapAssetSources(
  content: string | undefined,
  mapper: (path: string) => string,
  rootPath = '',
): string {
  if (content === undefined) return '';

  let updatedContent = content;
  const regex = /!\[(.*?)\]\((.*?)\)/g;
  const matches = [...updatedContent.matchAll(regex)];

  matches.forEach((match) => {
    const [fullMatch, alt, path] = match;
    if (path.startsWith('http')) return; // skip external links

    const mappedAssetSource = mapper(rootPath ? `${rootPath}/${path}` : path);
    updatedContent = updatedContent.replace(
      fullMatch,
      `![${alt}](${mappedAssetSource})`,
    );
  });

  return updatedContent;
}
