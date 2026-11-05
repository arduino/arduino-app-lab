import { SearchQuery } from '@codemirror/search';
import { EditorState } from '@codemirror/state';

import { iterable } from '../utils/utils';

self.onmessage = function handleCountRequest(
  msg: MessageEvent<{
    searchValue: string;
    doc: Uint8Array;
  }>,
): void {
  const { searchValue, doc: uInt8Array } = msg.data;

  const doc = new TextDecoder().decode(uInt8Array);

  const state = EditorState.create({ doc });
  const query = new SearchQuery({ search: searchValue, literal: true });
  const cursor = query.getCursor(state);

  const count = Array.from(iterable(cursor)).length;

  self.postMessage(count);
};
