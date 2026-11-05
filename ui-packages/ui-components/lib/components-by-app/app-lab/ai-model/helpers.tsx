import {
  IconFileArchiveOutNormal,
  IconTechnologyLinearAccelerationArrowNormal,
  MediaLibraryBooksNormal,
  MicroSD,
} from '@cloud-editor-mono/images/assets/icons';

import { formatBytes } from '../../../utils';
import {
  AiModelImpulse,
  BrickDetailModel,
  EDGE_IMPULSE_SOURCE,
  HUGGING_FACE_HOST,
  HUGGING_FACE_SOURCE,
  KnownModelSource,
  ModelSource,
  QUALCOMM_AI_HUB_SOURCE,
} from './AiModel.type';

const MODEL_FILE_EXTENSION = '.gguf';

const HUGGING_FACE_REPO_SEGMENTS = 2;

// Mark a url naming a file inside a repository, not the repository itself.
const HUGGING_FACE_FILE_MARKERS = ['resolve', 'blob'];

const MODEL_KEY_SEPARATOR = ':';

export const HUGGING_FACE_ORIGIN = `https://${HUGGING_FACE_HOST}`;

const KNOWN_MODEL_SOURCE_LABELS: Record<KnownModelSource, string> = {
  [EDGE_IMPULSE_SOURCE]: 'Edge Impulse',
  [HUGGING_FACE_SOURCE]: 'Hugging Face',
  [QUALCOMM_AI_HUB_SOURCE]: 'Qualcomm AI Hub',
};

const isKnownModelSource = (
  source: ModelSource,
): source is KnownModelSource => {
  return source in KNOWN_MODEL_SOURCE_LABELS;
};

const getModelSourceLabel = (source: ModelSource): string => {
  return isKnownModelSource(source)
    ? KNOWN_MODEL_SOURCE_LABELS[source]
    : source;
};

interface AiModelMetadataTag {
  order: number;
  label: string;
  path: string;
  className: string;
  formatFn: (value: string) => string;
  icon: React.ReactNode;
}

/** Metadata tags rendered (in `order`) on every model card when present. */
export const allowedMetadataTags: Record<string, AiModelMetadataTag> = {
  source: {
    order: 1,
    label: 'Source',
    path: 'source',
    className: 'source',
    formatFn: (value: string): string => getModelSourceLabel(value),
    icon: <IconFileArchiveOutNormal />,
  },
  runtime: {
    order: 2,
    label: 'Runtime',
    path: 'metadata.runtime',
    className: 'runtime',
    formatFn: (value: string): string => value,
    icon: <IconTechnologyLinearAccelerationArrowNormal />,
  },
  publisher: {
    order: 3,
    label: 'Publisher',
    path: 'metadata.publisher',
    className: 'publisher',
    formatFn: (value: string): string => value,
    icon: <MediaLibraryBooksNormal />,
  },
  'image-resolution': {
    order: 4,
    label: 'Image resolution',
    path: 'metadata.image-resolution',
    className: 'image-resolution',
    formatFn: (value: string): string => value,
    icon: <IconFileArchiveOutNormal />,
  },
  size: {
    order: 5,
    label: 'Size',
    path: 'size',
    className: 'size',
    formatFn: (value: string): string => formatBytes(+value),
    icon: <MicroSD />,
  },
};

// Mirrors is_hf_url in the hf-handler downloader: any scheme makes a url, so a
// mistyped ftp:// url is not read as a key naming a repository "ftp".
const URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

const isUrl = (source: string): boolean => {
  return URL_SCHEME_PATTERN.test(source);
};

const parseUrl = (source: string): URL | undefined => {
  try {
    return new URL(source);
  } catch {
    return undefined;
  }
};

const stripModelFileExtension = (name: string): string | undefined => {
  return name.toLowerCase().endsWith(MODEL_FILE_EXTENSION)
    ? name.slice(0, -MODEL_FILE_EXTENSION.length)
    : undefined;
};

// Keeps the whole repository on the card's repository line when no file is named.
const getRepoPlaceholderName = (repoPath: string): string => {
  return `${repoPath}/${repoPath.split('/').pop()}`;
};

// Mirrors parse_model_key in the hf-handler downloader:
// [<model_type>:]<repo_id>[:<quantization>[:<mmproj_quantization>]]
const parseModelKey = (
  key: string,
): {
  repoId: string;
  quantization?: string;
} => {
  const parts = key.split(MODEL_KEY_SEPARATOR);
  const [repoId, quantization] = parts.length > 2 ? parts.slice(1) : parts;

  return { repoId, quantization };
};

const getHuggingFaceModelKeyPlaceholderName = (key: string): string => {
  const { repoId, quantization } = parseModelKey(key);
  const repoName = getRepoPlaceholderName(repoId);

  if (!quantization) {
    return repoName;
  }

  const fileName = stripModelFileExtension(quantization);

  if (fileName) {
    return `${repoId}/${fileName}`;
  }

  return `${repoName}${MODEL_KEY_SEPARATOR}${quantization}`;
};

const getHuggingFaceModelUrlPlaceholderName = (source: string): string => {
  const parsed = parseUrl(source);

  if (!parsed) {
    return source;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? source;
  const fileName = stripModelFileExtension(lastSegment);

  if (segments.length >= HUGGING_FACE_REPO_SEGMENTS) {
    const repoPath = segments.slice(0, HUGGING_FACE_REPO_SEGMENTS).join('/');

    return fileName
      ? `${repoPath}/${fileName}`
      : getRepoPlaceholderName(repoPath);
  }

  return fileName ?? lastSegment;
};

// Once the download names its file, the board names the model
// `<repo>/<file stem>`, so the file replaces the last path segment.
export const getHuggingFaceModelPlaceholderName = (
  source: string,
  fileName?: string,
): string => {
  const placeholderName = isUrl(source)
    ? getHuggingFaceModelUrlPlaceholderName(source)
    : getHuggingFaceModelKeyPlaceholderName(source);
  const modelFileName = fileName && stripModelFileExtension(fileName);

  if (!modelFileName) {
    return placeholderName;
  }

  const separator = placeholderName.lastIndexOf('/');

  return separator === -1
    ? modelFileName
    : `${placeholderName.slice(0, separator)}/${modelFileName}`;
};

// A user model is named by the path it was downloaded from; every other model
// keeps its name whole, slashes included ("Arduino / gesture v2" is a name).
export const getModelDisplayName = (
  model: BrickDetailModel,
): {
  title: string;
  repository?: string;
} => {
  const separator = model.name.lastIndexOf('/');

  return separator === -1 || model.origin !== 'user'
    ? { title: model.name }
    : {
        title: model.name.slice(separator + 1),
        repository: model.name.slice(0, separator),
      };
};

export const isEdgeImpulseModel = (
  model: BrickDetailModel,
): model is BrickDetailModel & {
  edgeImpulseProps: NonNullable<BrickDetailModel['edgeImpulseProps']>;
} => {
  return !!model.edgeImpulseProps;
};

const getModelKeyPageUrl = (key: string): string => {
  if (!key) {
    return key;
  }

  return `${HUGGING_FACE_ORIGIN}/${parseModelKey(key).repoId}`;
};

// A Hugging Face file url reduces to its repository page; anything else is
// already a page.
const getModelUrlPageUrl = (url: string): string => {
  const parsed = parseUrl(url);

  if (!parsed) {
    return url;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const isFileUrl = HUGGING_FACE_FILE_MARKERS.includes(
    segments[HUGGING_FACE_REPO_SEGMENTS],
  );

  if (parsed.hostname !== HUGGING_FACE_HOST || !isFileUrl) {
    return url;
  }

  return `${HUGGING_FACE_ORIGIN}/${segments
    .slice(0, HUGGING_FACE_REPO_SEGMENTS)
    .join('/')}`;
};

export const getModelPageUrl = (source: string): string => {
  return isUrl(source)
    ? getModelUrlPageUrl(source)
    : getModelKeyPageUrl(source);
};

/**
 * Returns the downloadable source URL the board's list declares for the model,
 * or `undefined` when it declares none.
 */
export const getDownloadableSourceUrl = (
  model: BrickDetailModel,
): string | undefined => {
  return model.metadata?.['source-model-url'];
};

/**
 * A generic (non-Edge-Impulse) model can be downloaded when it exposes a
 * downloadable source and is not installed yet. An Edge Impulse card is
 * excluded here rather than by the url: it acts on a chosen impulse.
 */
export const canDownloadModel = (model: BrickDetailModel): boolean => {
  return (
    !isEdgeImpulseModel(model) &&
    !model.isInstalled &&
    !!getDownloadableSourceUrl(model)
  );
};

/**
 * A generic (non-Edge-Impulse) downloadable model that is installed, and can
 * therefore be uninstalled.
 */
export const canUninstallModel = (model: BrickDetailModel): boolean => {
  return (
    !isEdgeImpulseModel(model) &&
    !!model.isInstalled &&
    !!getDownloadableSourceUrl(model)
  );
};

interface AiModelCardStateParams {
  model: BrickDetailModel;
  /** The model configured on the brick instance (`brickInstance.model`). */
  inUseModelId?: string;
  /** The model pre-selected by the user (add-brick flow). */
  selectedModelId?: string;
  /**
   * The brick belongs to an example or an installed release: its model cannot
   * be changed.
   */
  isReadOnlyApp?: boolean;
  /** Brick list view: no app context, selection is hidden. */
  readOnly?: boolean;
  impulses: AiModelImpulse[];
  selectedImpulse?: AiModelImpulse;
  impulseInUse?: AiModelImpulse;
}

interface AiModelCardState {
  isEdgeImpulse: boolean;
  /**
   * Whether what the card currently shows is installed: built-in models ship
   * with the board (their `status` is never `installed`, so `isInstalled` is
   * false for them), while for Edge Impulse models the unit of installation
   * is the selected impulse.
   */
  isModelInstalled: boolean;
  /** The model (or one of its impulses) is the brick instance one. */
  isModelInUse: boolean;
  isModelSelected: boolean;
  /** The card can be clicked to select the model. */
  isSelectable: boolean;
  isDisabled: boolean;
  /**
   * Install/uninstall actions are allowed on this card. Built-in models can
   * never be (un)installed; in read-only apps only the in-use model can, so
   * the user can download what is needed to run the app.
   */
  allowsInstallActions: boolean;
}

/**
 * Derives the interaction state of a model card.
 *
 * In read-only apps (examples and installed releases) the model is fixed to
 * `brickInstance.model`: that model is shown as selected and is the only one
 * that can be installed/uninstalled (when not built-in); every other model is
 * disabled. In regular apps and in the brick list, built-in models cannot be
 * uninstalled while all other models can be installed/uninstalled freely.
 */
export const getAiModelCardState = ({
  model,
  inUseModelId,
  selectedModelId,
  isReadOnlyApp,
  readOnly,
  impulses,
  selectedImpulse,
  impulseInUse,
}: AiModelCardStateParams): AiModelCardState => {
  const isEdgeImpulse = isEdgeImpulseModel(model);

  const isModelInstalled =
    model.isBuiltIn ||
    (isEdgeImpulse ? !!selectedImpulse?.isInstalled : model.isInstalled);

  // A generic model counts as "in use" only while it is still installed:
  // uninstalling it must clear the selection. The brick keeps its `model`
  // reference server-side (the API has no way to clear it), so this is derived
  // from install state rather than the reference, and it survives reload.
  // Edge Impulse models get this for free because `impulseInUse` is keyed on
  // the impulse's `installedModelId`, which is unset once uninstalled.
  // Read-only apps are exempt: their fixed model is shown selected so it can
  // be downloaded.
  const isModelInUse =
    !!inUseModelId &&
    ((!isEdgeImpulse &&
      model.id === inUseModelId &&
      (isReadOnlyApp || model.isInstalled)) ||
      !!impulseInUse ||
      // In a read-only app the fixed model may be an unlinked Edge Impulse
      // model the board can download but that isn't installed yet — so it has
      // no `installedModelId`, hence no `impulseInUse`. Match it by its
      // downloadable board model id so the card auto-selects and shows its
      // download CTA (the brick instance's `model` is the app default).
      (!!isReadOnlyApp &&
        isEdgeImpulse &&
        impulses.some((i) => i.downloadModelId === inUseModelId)));

  // In read-only apps the selected model is always the brick instance one;
  // elsewhere it follows the model id (pre)selected by the user.
  const isModelSelected = isReadOnlyApp
    ? isModelInUse
    : !!selectedModelId &&
      (model.id === selectedModelId ||
        impulses.some((i) => i.installedModelId === selectedModelId));

  const isSelectable =
    !isReadOnlyApp &&
    !readOnly &&
    !isModelInUse &&
    !isModelSelected &&
    isModelInstalled;

  // Read-only apps disable every model but the in-use one; elsewhere a model
  // is disabled until installed.
  const isDisabled = isReadOnlyApp ? !isModelInUse : !isModelInstalled;

  const allowsInstallActions =
    !model.isBuiltIn && (!isReadOnlyApp || isModelInUse);

  return {
    isEdgeImpulse,
    isModelInstalled,
    isModelInUse,
    isModelSelected,
    isSelectable,
    isDisabled,
    allowsInstallActions,
  };
};
