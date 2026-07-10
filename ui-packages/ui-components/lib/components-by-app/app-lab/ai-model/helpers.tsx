import {
  IconFileArchiveOutNormal,
  IconMediaLibraryBooksNormal,
  IconTechnologyLinearAccelerationArrowNormal,
} from '@arduino/react-icons';
import { MicroSD } from '@cloud-editor-mono/images/assets/icons';
import {
  BrickDetailModel,
  BrickDetailModelImpulse,
  formatBytes,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

/** Value of `metadata.source` used by Edge Impulse models. */
export const EDGE_IMPULSE_SOURCE = 'edgeimpulse';

/** Maps a raw `source` value to its human-readable provider name. */
function makeLabelReadable(label: string): string {
  switch (label) {
    case 'edgeimpulse':
      return 'Edge Impulse';
    case 'qualcomm-ai-hub':
      return 'Qualcomm AI Hub';
    case 'huggingface':
      return 'Hugging Face';
    default:
      return label;
  }
}

export interface AiModelMetadataTag {
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
    formatFn: (value: string): string => makeLabelReadable(value),
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
    icon: <IconMediaLibraryBooksNormal />,
  },
  'image-resolution': {
    order: 4,
    label: 'Image resolution',
    path: 'metadata.image-resolution',
    className: 'image-resolution',
    formatFn: (value: string): string => value,
    icon: <IconFileArchiveOutNormal />,
  },
  model_size_mb: {
    order: 5,
    label: 'Size',
    path: 'metadata.model_size_mb',
    className: 'model_size_mb',
    formatFn: (value: string): string => formatBytes(+value * 1024 * 1024),
    icon: <MicroSD />,
  },
};

/** A model is an Edge Impulse model when it carries `edgeImpulseProps`. */
export function isEdgeImpulseModel(model: BrickDetailModel): boolean {
  return !!model.edgeImpulseProps;
}

/**
 * Returns the downloadable source URL for non-Edge-Impulse models, or
 * `undefined` when the model is not a generic downloadable model.
 */
export function getDownloadableSourceUrl(
  model: BrickDetailModel,
): string | undefined {
  const sourceModelUrl = model.metadata?.['source-model-url'];
  return sourceModelUrl && model.metadata?.source !== EDGE_IMPULSE_SOURCE
    ? sourceModelUrl
    : undefined;
}

/**
 * A generic (non-Edge-Impulse) model can be downloaded when it exposes a
 * downloadable source and is not installed yet.
 */
export function canDownloadModel(model: BrickDetailModel): boolean {
  return !model.isInstalled && !!getDownloadableSourceUrl(model);
}

/**
 * A generic (non-Edge-Impulse) downloadable model that is installed, and can
 * therefore be uninstalled.
 */
export function isInstalledDownloadableModel(model: BrickDetailModel): boolean {
  return !!model.isInstalled && !!getDownloadableSourceUrl(model);
}

export interface AiModelCardStateParams {
  model: BrickDetailModel;
  /** The model configured on the brick instance (`brickInstance.model`). */
  inUseModelId?: string;
  /** The model pre-selected by the user (add-brick flow). */
  selectedModelId?: string;
  /** The brick belongs to an example app: its model cannot be changed. */
  isExample?: boolean;
  /** Brick list view: no app context, selection is hidden. */
  readOnly?: boolean;
  impulses: BrickDetailModelImpulse[];
  selectedImpulse?: BrickDetailModelImpulse;
  impulseInUse?: BrickDetailModelImpulse;
}

export interface AiModelCardState {
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
   * never be (un)installed; in examples only the in-use model can, so the
   * user can download what is needed to run the example.
   */
  allowsInstallActions: boolean;
}

/**
 * Derives the interaction state of a model card.
 *
 * In example apps the model is fixed to `brickInstance.model`: that model is
 * shown as selected and is the only one that can be installed/uninstalled
 * (when not built-in); every other model is disabled. In regular apps and in
 * the brick list, built-in models cannot be uninstalled while all other
 * models can be installed/uninstalled freely.
 */
export function getAiModelCardState({
  model,
  inUseModelId,
  selectedModelId,
  isExample,
  readOnly,
  impulses,
  selectedImpulse,
  impulseInUse,
}: AiModelCardStateParams): AiModelCardState {
  const isEdgeImpulse = isEdgeImpulseModel(model);

  const isModelInstalled =
    model.isBuiltIn ||
    (isEdgeImpulse ? !!selectedImpulse?.isInstalled : model.isInstalled);

  // A generic model counts as "in use" only while it is still installed:
  // uninstalling it must clear the selection. The brick keeps its `model`
  // reference server-side (the API has no way to clear it), so this is derived
  // from install state rather than the reference, and it survives reload.
  // Edge Impulse models get this for free because `impulseInUse` is keyed on
  // the impulse's `installedModelId`, which is unset once uninstalled. Examples
  // are exempt: their fixed model is shown selected so it can be downloaded.
  const isModelInUse =
    !!inUseModelId &&
    ((!isEdgeImpulse &&
      model.id === inUseModelId &&
      (isExample || model.isInstalled)) ||
      !!impulseInUse ||
      // In an example the fixed model may be an unlinked Edge Impulse model the
      // board can download but that isn't installed yet — so it has no
      // `installedModelId`, hence no `impulseInUse`. Match it by its
      // downloadable board model id so the card auto-selects and shows its
      // download CTA (the brick instance's `model` is the example default).
      (!!isExample &&
        isEdgeImpulse &&
        impulses.some((i) => i.downloadModelId === inUseModelId)));

  // In examples the selected model is always the brick instance one;
  // elsewhere it follows the model id (pre)selected by the user.
  const isModelSelected = isExample
    ? isModelInUse
    : !!selectedModelId &&
      (model.id === selectedModelId ||
        impulses.some((i) => i.installedModelId === selectedModelId));

  const isSelectable =
    !isExample &&
    !readOnly &&
    !isModelInUse &&
    !isModelSelected &&
    isModelInstalled;

  // Examples disable every model but the in-use one; elsewhere a model is
  // disabled until installed.
  const isDisabled = isExample ? !isModelInUse : !isModelInstalled;

  const allowsInstallActions = !model.isBuiltIn && (!isExample || isModelInUse);

  return {
    isEdgeImpulse,
    isModelInstalled,
    isModelInUse,
    isModelSelected,
    isSelectable,
    isDisabled,
    allowsInstallActions,
  };
}
