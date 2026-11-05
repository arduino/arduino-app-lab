import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { BoardScopedQuery } from '../../../boardScopedQuery';
import { openFilesQueryKey } from './hooks/useEditorFiles';
import { moveAppQueries, renamedAppPath } from './renameInPlace';

const APPS_DIR = '/home/arduino/ArduinoApps';

const base64url = (text: string): string =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const userAppId = (folder: string): string => base64url(`user:${folder}`);

describe('renamedAppPath', () => {
  it('moves the path to the folder the new id names', () => {
    expect(
      renamedAppPath(
        `${APPS_DIR}/blink`,
        userAppId('blink'),
        userAppId('blink-fast'),
      ),
    ).toBe(`${APPS_DIR}/blink-fast`);
  });

  it('decodes the url-safe alphabet', () => {
    const oldId = userAppId('?x');
    expect(oldId).toContain('_');

    expect(renamedAppPath(`${APPS_DIR}/?x`, oldId, userAppId('x'))).toBe(
      `${APPS_DIR}/x`,
    );
  });

  it('gives up on an id that is not a user app', () => {
    const newId = userAppId('blink-fast');

    expect(
      renamedAppPath(`${APPS_DIR}/blink`, base64url('examples:blink'), newId),
    ).toBeUndefined();
    expect(
      renamedAppPath(`${APPS_DIR}/blink`, 'not base64!', newId),
    ).toBeUndefined();
  });

  it('gives up when the path does not end in the folder of the old id', () => {
    expect(
      renamedAppPath(
        '/elsewhere/other',
        userAppId('blink'),
        userAppId('blink-fast'),
      ),
    ).toBeUndefined();
  });
});

describe('moveAppQueries', () => {
  it('copies the app queries onto the new id, the detail renamed', () => {
    const queryClient = new QueryClient();
    const oldId = userAppId('blink');
    const newId = userAppId('blink-fast');
    const renamed = {
      id: newId,
      name: 'Blink fast',
      path: `${APPS_DIR}/blink-fast`,
      status: 'stopped',
    } as AppDetailedInfo;
    const listing = [{ name: 'main.py', path: 'python/main.py' }];
    queryClient.setQueryData([BoardScopedQuery.LIST_MY_APPS, oldId], {
      ...renamed,
      id: oldId,
      name: 'Blink',
      path: `${APPS_DIR}/blink`,
    });
    queryClient.setQueryData(
      [BoardScopedQuery.APP_DIR, oldId, 'python'],
      listing,
    );
    queryClient.setQueryData([BoardScopedQuery.APP_DEFAULT_FILE, oldId], null);
    queryClient.setQueryData(
      [BoardScopedQuery.GET_BRICK_INSTANCE, 'arduino:camera', oldId],
      { id: 'arduino:camera' },
    );
    queryClient.setQueryData(openFilesQueryKey(`${oldId}-serial`), {
      items: ['python/main.py'],
    });
    queryClient.setQueryData(
      [BoardScopedQuery.APP_BRICKS, userAppId('other')],
      [],
    );

    moveAppQueries(queryClient, oldId, renamed, `${oldId}-serial`);

    expect(
      queryClient.getQueryData([BoardScopedQuery.LIST_MY_APPS, newId]),
    ).toBe(renamed);
    expect(
      queryClient.getQueryData([BoardScopedQuery.APP_DIR, newId, 'python']),
    ).toBe(listing);
    expect(
      queryClient.getQueryData([BoardScopedQuery.APP_DEFAULT_FILE, newId]),
    ).toBeNull();
    expect(
      queryClient.getQueryData([
        BoardScopedQuery.GET_BRICK_INSTANCE,
        'arduino:camera',
        newId,
      ]),
    ).toEqual({ id: 'arduino:camera' });
    expect(
      queryClient.getQueryData(openFilesQueryKey(`${newId}-serial`)),
    ).toEqual({ items: ['python/main.py'] });
    expect(
      queryClient.getQueryCache().findAll({
        queryKey: [BoardScopedQuery.APP_BRICKS],
      }),
    ).toHaveLength(1);
  });
});
