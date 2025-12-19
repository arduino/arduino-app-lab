import { State } from '@cloud-editor-mono/common';
import { scan, shareReplay, Subject } from 'rxjs';

export const END_UPLOAD_STREAM_SIGNAL = 'END';
export const COMPILE_STREAM_UPDATE = 'COMPILE_STREAM_UPDATE';

type UploadResponseStreamValue = {
  value: string;
  meta?: {
    signal: typeof END_UPLOAD_STREAM_SIGNAL | typeof COMPILE_STREAM_UPDATE;
  };
};
export type UploadConcatResponseStream = Subject<string>;
export type UploadResponseStream = Subject<UploadResponseStreamValue>;

function instantiateUploadResponseStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
): UploadResponseStream {
  const uploadResponseStream$ = new Subject<UploadResponseStreamValue>();
  setState({ uploadResponseStream$ });

  return uploadResponseStream$;
}

function getUploadResponseStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
): UploadResponseStream {
  let { uploadResponseStream$ } = state;
  if (uploadResponseStream$) return uploadResponseStream$;

  uploadResponseStream$ = instantiateUploadResponseStream(setState);

  return uploadResponseStream$;
}

export function uploadResponseStreamNext<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
  value: string,
  meta?: UploadResponseStreamValue['meta'],
): void {
  const uploadResponseStream$ = getUploadResponseStream(setState, state);

  uploadResponseStream$.next({ value, meta });
}

// cumulative upload stream
function instantiateUploadConcatResponseStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  subject: UploadResponseStream,
): UploadConcatResponseStream {
  const uploadConcatResponseStream$ = subject.pipe(
    scan((acc, { value, meta }) => {
      if (meta?.signal === END_UPLOAD_STREAM_SIGNAL) return '';

      if (meta?.signal === COMPILE_STREAM_UPDATE) {
        return value;
      }

      return `${acc && `${acc}\n`}${value || ''}`;
    }, ''),
    shareReplay(1),
  ) as UploadConcatResponseStream;
  // assert, as we know `source` is a subject, so `lift` will ensure the
  // observable returned from `pipe` is a `Subject`
  // https://github.com/ReactiveX/rxjs/issues/3861#issuecomment-400126524
  setState({ uploadConcatResponseStream$ });

  return uploadConcatResponseStream$;
}

export function getUploadConcatResponseStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
): UploadConcatResponseStream {
  let { uploadConcatResponseStream$ } = state;
  if (uploadConcatResponseStream$) return uploadConcatResponseStream$;

  let { uploadResponseStream$ } = state;
  if (!uploadResponseStream$) {
    uploadResponseStream$ = instantiateUploadResponseStream(setState);
  }

  uploadConcatResponseStream$ = instantiateUploadConcatResponseStream(
    setState,
    uploadResponseStream$,
  );

  return uploadConcatResponseStream$;
}

export function clearUploadResponseStream<T extends State<T>>(
  setState: (newStateProps: Partial<State<T>>, doNotEmit?: boolean) => void,
  state: T,
): void {
  const { uploadResponseStream$ } = state;
  if (!uploadResponseStream$) return;

  uploadResponseStreamNext(setState, state, '', {
    signal: END_UPLOAD_STREAM_SIGNAL,
  });

  uploadResponseStream$.complete();
  setState({ uploadResponseStream$: undefined });

  const { uploadConcatResponseStream$ } = state;
  if (!uploadConcatResponseStream$) return;

  uploadConcatResponseStream$.complete();
  setState({ uploadConcatResponseStream$: undefined });
}
