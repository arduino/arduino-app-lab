export interface TrackingEventFixedPayload {
  INIT: {
    event: 'web_editor_initiate';
  };
  COMPILE: {
    event: 'web_editor_compile';
  };
  UPLOAD: {
    event: 'web_editor_upload';
  };
  SKETCH_MOD: {
    event: 'editor_sketch_interaction';
  };
  BOARD_CHANGE: {
    event: 'editor_board_selection';
  };
  EXAMPLE_SELECT: {
    event: 'editor_examples';
  };
  LIBRARY_SELECT: {
    event: 'editor_libraries';
  };
  LIBRARY_FAVORITE: {
    event: 'editor_libraries';
    action: 'add to favorites';
  };
  REFERENCE_VIEW: {
    event: 'editor_reference';
    action: 'view_reference';
  };
  GEN_AI_INTERACTION: {
    event: 'ai_interaction';
  };
}

export interface TrackingEventDynamicPayload {
  INIT: undefined;
  COMPILE: {
    sketch_id: string;
  };
  UPLOAD: {
    sketch_id: string;
  };
  SKETCH_MOD: {
    sketch_id: string;
    action: 'sketch_rename' | 'sketch_delete' | 'sketch_download';
  };
  BOARD_CHANGE: {
    sketch_id: string;
    type: string;
  };
  EXAMPLE_SELECT: {
    sketch_id: string;
    name: string;
    action: 'view_code' | 'download_code';
  };
  LIBRARY_SELECT: {
    sketch_id: string;
    name: string;
    action: 'modify_library' | 'download_library';
  };
  LIBRARY_FAVORITE: {
    sketch_id: string;
    name: string;
  };
  REFERENCE_VIEW: {
    sketch_id: string;
    type: string;
  };
  GEN_AI_INTERACTION: {
    action:
      | 'question submitted'
      | 'chat deleted'
      | 'sketch generation template submitted'
      | 'sketch confirmed'
      | 'sketch copied';
  };
}

export type TrackingEventKey = keyof TrackingEventFixedPayload;

export type EmitTrackingEvent<K extends keyof TrackingEventDynamicPayload> =
  TrackingEventDynamicPayload[K] extends Record<string, unknown>
    ? { type: K; payload: TrackingEventDynamicPayload[K] }
    : { type: K; payload?: undefined };
