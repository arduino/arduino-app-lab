import {
  CodeSubjectById,
  GetSketchesResult,
  RetrieveExampleFileContentsResult,
  RetrieveFileContentsResult,
  transformContentToDataByMimeType,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import {
  Bricks,
  FileConfig as FileConfigIcon,
  FileFolder as FileFolderIcon,
  FileGeneric as FileGenericIcon,
  FileHeader as FileHeaderIcon,
  FileImage as FileImageIcon,
  FileIno as FileInoIcon,
  FilePython as FilePythonIcon,
  FileText as FileTextIcon,
  FileTypeHeader,
  FileTypeImage,
  FileTypeIno,
  FileTypeSecrets,
  FileTypeText,
} from '@cloud-editor-mono/images/assets/icons';
import { GetFilesList_Response } from '@cloud-editor-mono/infrastructure';
import { SelectableFileData } from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { FunctionComponent, SVGProps, useCallback } from 'react';

import { BasicFileData, BasicFilesData } from './hooks/files.type';
import { useRetrieveSketches } from './hooks/queries/createShared';

interface CreateSelectableFileDataOptions {
  fileData:
    | RetrieveFileContentsResult
    | { name: string; fullName: string; path: string; extension: string };
  isMetadataReadOnly?: boolean;
  isFixed?: boolean;
  tags?: string[];
  isClassicSketch?: boolean;
}

export function createSelectableFileData(
  options: CreateSelectableFileDataOptions,
): SelectableFileData {
  const {
    fileData,
    isMetadataReadOnly = false,
    isFixed = false,
    tags = [],
    isClassicSketch = true,
  } = options;

  return {
    fileId: fileData.path,
    fileFullName: fileData.fullName,
    fileName: fileData.name,
    fileExtension: fileData.extension,
    Icon: isClassicSketch
      ? getFileIcon(fileData.extension)
      : getAppLabFileIcon(
          fileData.name === 'app.yaml' ? 'config' : fileData.extension,
        ),
    tags,
    isFixed,
    isMetadataReadOnly,
  };
}

export function getMainLibraryFile<
  T extends
    | RetrieveFileContentsResult[]
    | GetFilesList_Response
    | BasicFilesData,
>(files: T): T[0] | undefined {
  const readmeFile = files?.find(isReadmeFile);
  if (readmeFile) return readmeFile;

  if (!readmeFile) return files?.find(isPropertiesFile);
}

export function getFileIcon(
  extension: string,
):
  | FunctionComponent<SVGProps<SVGSVGElement> & { title?: string | undefined }>
  | undefined {
  switch (extension) {
    case 'ino':
    case 'cpp':
    case 'c':
    case 'pde':
      return FileTypeIno;
    case 'h':
      return FileTypeHeader;
    case 'txt':
    case 'adoc':
    case 'md':
    case 'asciidoc':
    case 'asc':
      return FileTypeText;
    case 'png':
    case 'jpg':
    case 'svg':
      return FileTypeImage;
    case 'secrets':
      return FileTypeSecrets;
    default:
      return undefined;
  }
}

export function getAppLabFileIcon(
  extension: string,
): FunctionComponent<SVGProps<SVGSVGElement> & { title?: string | undefined }> {
  switch (extension) {
    case 'ino':
    case 'cpp':
    case 'c':
    case 'pde':
      return FileInoIcon;
    case 'h':
      return FileHeaderIcon;
    case 'txt':
    case 'adoc':
    case 'asciidoc':
    case 'asc':
      return FileTextIcon;
    case 'py':
      return FilePythonIcon;
    case 'png':
    case 'jpg':
    case 'svg':
      return FileImageIcon;
    case 'brick':
      return Bricks;
    case 'folder':
      return FileFolderIcon;
    case 'config':
      return FileConfigIcon;
    default:
      return FileGenericIcon;
  }
}

export const isReadmeFile = (
  file: RetrieveFileContentsResult | GetFilesList_Response[0] | BasicFileData,
): boolean => file.name.toLowerCase().includes('readme');

export const isPropertiesFile = (
  file: RetrieveFileContentsResult | GetFilesList_Response[0] | BasicFileData,
): boolean =>
  ((f): f is RetrieveFileContentsResult => 'fullName' in f)(file)
    ? file.fullName === 'library.properties'
    : file.name === 'library.properties';

export type UseGetProposedSketchName = (
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  inoData?: RetrieveFileContentsResult | RetrieveExampleFileContentsResult,
) => {
  getProposedSketchName: () => Promise<string | undefined>;
};

export const useGetProposedSketchName: UseGetProposedSketchName = function (
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  inoData?: RetrieveFileContentsResult | RetrieveExampleFileContentsResult,
): ReturnType<UseGetProposedSketchName> {
  const copyPrefix = inoData ? `${inoData.name}_copy-` : undefined;

  const { refetch: refetchSketches } = useRetrieveSketches(
    false,
    retrieveSketches,
    'get-sketches-for-created-sketch-name',
    0,
    copyPrefix,
  );

  const getProposedSketchName = useCallback(async () => {
    if (!copyPrefix) return;
    const { data: sketchesData } = await refetchSketches();

    if (!sketchesData) return;

    const matchingSketches = sketchesData.filter((sketch) =>
      sketch.name.startsWith(copyPrefix),
    );

    const nSuffix = matchingSketches.length + 1;
    let proposedSketchName = `${copyPrefix}${matchingSketches.length + 1}`;

    const sketchAlreadyExists = (proposal: string): boolean =>
      matchingSketches.some((sketch) => sketch.name === proposal);

    if (sketchAlreadyExists(proposedSketchName)) {
      for (let i = nSuffix; i < 100; i++) {
        proposedSketchName = `${copyPrefix}${i}`;

        if (!sketchAlreadyExists(proposedSketchName)) break;

        if (i === 99) {
          proposedSketchName = `${copyPrefix}${new Date().valueOf()}`;
        }
      }
    }

    return proposedSketchName;
  }, [copyPrefix, refetchSketches]);

  return { getProposedSketchName };
};

export function createUpdatedExamplePayload<
  T extends RetrieveExampleFileContentsResult,
>(
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  exampleInoData: T,
  exampleFilesData?: T[],
): {
  exampleIno: T;
  exampleFiles: T[];
} {
  const inoCodeData = transformContentToDataByMimeType(
    getCodeSubjectById(exampleInoData.path).value.value,
    exampleInoData.mimetype,
  );

  const updatedFiles = exampleFilesData
    ? exampleFilesData.map((f) => updateFileData(f, getCodeSubjectById))
    : [];

  return {
    exampleIno: { ...exampleInoData, data: inoCodeData },
    exampleFiles: updatedFiles,
  };
}

export function updateFileData<
  T extends RetrieveFileContentsResult | RetrieveExampleFileContentsResult,
>(file: T, getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>): T {
  const id = file.path;
  const content = getCodeSubjectById(id).value.value;
  const data = transformContentToDataByMimeType(content, file.mimetype);

  return { ...file, data, content };
}
