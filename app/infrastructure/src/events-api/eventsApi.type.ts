export type AIInteraction_Events =
  | 'chat deleted'
  | 'sketch generation template submitted'
  | 'sketch confirmed'
  | 'sketch copied';

export type AIInteraction_Body_Events =
  | {
      category: 'ai-interaction';
      action: Omit<
        AIInteraction_Events,
        'sketch generation template submitted'
      >;
    }
  | {
      category: 'ai-interaction';
      action: 'sketch generation template submitted';
      'question-submitted': string;
    };

export interface AIQuestionSubmitted_Body_Events {
  category: 'ai-question submitted';
  action: 'question submitted';
  'question-submitted': string;
}

export interface ActionBody_Events {
  category: string;
  action: string;
} // TODO: to be replaced with specific actions

export interface SketchDataBody_Events {
  sketch?: string;
  board: string | null;
  board_type: string | null;
  hex_len: number | null;
  error_code: string | null;
  error_message: string | null;
}

export interface Body_Events {
  data:
    | SketchDataBody_Events
    | ActionBody_Events
    | AIInteraction_Body_Events
    | AIQuestionSubmitted_Body_Events;
  subtype?: string;
}
