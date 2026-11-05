export enum RbacCapability {
  EditSketch = 'canEditSketch',
  CreateSketch = 'canCreateSketch',
  DeleteSketch = 'canDeleteSketch',
  UploadSketch = 'canUploadSketch',
  CopyFromPreview = 'canCopyFromPreview',
  UpdateThing = 'canUpdateThing',
}

export type RbacValue = Record<RbacCapability, boolean>;
