import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export interface FileAdapter {
  nameWithExt: string;
  base64Content?: string;
  textContent?: string;
  isDirectory?: boolean;
}

export function createZipArchive(
  files: FileAdapter[],
  rootFolderName?: string,
): Promise<Blob> {
  const zip = new JSZip();
  const rootFolder = rootFolderName ? zip.folder(rootFolderName) || zip : zip;

  files.forEach((file: FileAdapter) => {
    try {
      const filePath = rootFolderName
        ? `${rootFolderName}/${file.nameWithExt}`
        : file.nameWithExt;

      if (!file.isDirectory && !file.base64Content && !file.textContent) {
        rootFolder.file(filePath, '');
        return;
      }

      if (file.isDirectory) {
        rootFolder.folder(filePath);
      } else {
        // Prefer original base64 data if available since it is more reliable, if not available generate it from content
        rootFolder.file(
          filePath,
          file.base64Content || btoa(file.textContent as string),
          {
            base64: true,
          },
        );
      }
    } catch (e) {
      console.error(`Failed to add file ${file.nameWithExt} to zip archive`, e);
    }
  });

  return zip.generateAsync({ type: 'blob' });
}

export async function exportZipFolder(
  path: string,
  files: FileAdapter[],
  rootFolderName?: string,
): Promise<void> {
  const archive = await createZipArchive(files, rootFolderName);
  saveAs(archive, `${path}.zip`);
}

export async function readZipArchive(archive: File): Promise<FileAdapter[]> {
  const zip = new JSZip();

  const loadedArchive = await zip.loadAsync(archive);

  const files: FileAdapter[] = [];
  for (const fileKey in loadedArchive.files) {
    const file = loadedArchive.files[fileKey];
    files.push({
      nameWithExt: file.name.replace(
        `${archive.name.replace('.zip', '')}/`,
        '',
      ),
      base64Content: await file.async('base64'),
      isDirectory: file.dir,
    });
  }

  return files;
}
