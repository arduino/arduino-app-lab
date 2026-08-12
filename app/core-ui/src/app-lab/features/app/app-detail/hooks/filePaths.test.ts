import { describe, expect, it } from 'vitest';

import {
  isAbsoluteId,
  isHostLocalId,
  resolveAbsPath,
  splitFileName,
  toAppRelativeId,
  withoutHostLocalIds,
} from './filePaths';

describe('filePaths', () => {
  describe('isHostLocalId', () => {
    it('recognises a host-local id', () => {
      expect(isHostLocalId('file:///Users/me/scratch.md')).toBe(true);
    });

    it('does not treat onboard or app-relative ids as host-local', () => {
      expect(isHostLocalId('/apps/foo/main.py')).toBe(false);
      expect(isHostLocalId('main.py')).toBe(false);
    });
  });

  describe('withoutHostLocalIds', () => {
    it('drops host-local tabs and clears them as the selection', () => {
      const cleaned = withoutHostLocalIds({
        items: ['main.py', 'file:///Users/me/scratch.md', '/apps/foo/other.py'],
        selected: 'file:///Users/me/scratch.md',
        previewFileId: 'file:///Users/me/scratch.md',
      });

      expect(cleaned.items).toEqual(['main.py', '/apps/foo/other.py']);
      expect(cleaned.selected).toBeNull();
      expect(cleaned.previewFileId).toBeNull();
    });

    it('cleans both panes, including their per-file state', () => {
      const cleaned = withoutHostLocalIds({
        items: ['main.py'],
        selected: 'main.py',
        panes: {
          A: {
            items: ['main.py', 'file:///Users/me/a.md'],
            selected: 'main.py',
            markdownByFileId: {
              'file:///Users/me/a.md': true,
              'docs.md': true,
            },
          },
          B: {
            items: ['file:///Users/me/b.md'],
            selected: 'file:///Users/me/b.md',
            brickTabByFileId: { 'file:///Users/me/b.md': 'overview' },
          },
        },
      });

      expect(cleaned.panes?.A.items).toEqual(['main.py']);
      expect(cleaned.panes?.A.markdownByFileId).toEqual({ 'docs.md': true });
      expect(cleaned.panes?.B?.items).toEqual([]);
      expect(cleaned.panes?.B?.selected).toBeNull();
      expect(cleaned.panes?.B?.brickTabByFileId).toEqual({});
    });

    it('leaves a record with no host-local ids alone', () => {
      const item = {
        items: ['main.py', '/apps/foo/other.py'],
        selected: 'main.py',
        isSplit: false,
        splitProportionLeft: 50,
      };

      expect(withoutHostLocalIds(item)).toEqual(item);
    });
  });

  describe('isAbsoluteId', () => {
    it('treats an onboard-absolute id as absolute', () => {
      expect(isAbsoluteId('/apps/foo/main.py')).toBe(true);
    });

    it('treats a host-local file:// id as absolute', () => {
      expect(isAbsoluteId('file:///Users/me/scratch.md')).toBe(true);
    });

    it('treats an app-relative id as not absolute', () => {
      expect(isAbsoluteId('main.py')).toBe(false);
      expect(isAbsoluteId('sketch/sketch.yaml')).toBe(false);
    });
  });

  describe('resolveAbsPath', () => {
    it('joins an app-relative id onto the app path', () => {
      expect(resolveAbsPath('main.py', '/apps/foo')).toBe('/apps/foo/main.py');
    });

    it('returns an already onboard-absolute id unchanged', () => {
      expect(resolveAbsPath('/apps/foo/main.py', '/apps/bar')).toBe(
        '/apps/foo/main.py',
      );
    });

    it('returns a host-local id unchanged', () => {
      expect(resolveAbsPath('file:///Users/me/scratch.md', '/apps/foo')).toBe(
        'file:///Users/me/scratch.md',
      );
    });

    it('resolves against an empty base when the app path is missing', () => {
      expect(resolveAbsPath('main.py', undefined)).toBe('/main.py');
    });
  });

  describe('toAppRelativeId', () => {
    it('strips the app path prefix to yield the app-relative id', () => {
      expect(toAppRelativeId('/apps/foo/test/test1.txt', '/apps/foo')).toBe(
        'test/test1.txt',
      );
    });

    it('is the inverse of resolveAbsPath for an app-relative id', () => {
      const appPath = '/apps/foo';
      const abs = resolveAbsPath('sketch/sketch.ino', appPath);
      expect(toAppRelativeId(abs, appPath)).toBe('sketch/sketch.ino');
    });

    it('returns a path outside the app unchanged', () => {
      expect(toAppRelativeId('/apps/bar/main.py', '/apps/foo')).toBe(
        '/apps/bar/main.py',
      );
    });

    it('returns the path unchanged when the app path is missing', () => {
      expect(toAppRelativeId('/apps/foo/main.py', undefined)).toBe(
        '/apps/foo/main.py',
      );
    });
  });

  describe('splitFileName', () => {
    it('splits a plain name', () => {
      expect(splitFileName('main.py')).toEqual({
        fileName: 'main',
        fileExtension: 'py',
      });
    });

    it('reports no extension for a name without a dot', () => {
      // `'Makefile'.split('.')` used to leave the extension `undefined`, which
      // was then passed on as a `string`.
      expect(splitFileName('Makefile')).toEqual({
        fileName: 'Makefile',
        fileExtension: '',
      });
    });

    it('splits on the last dot only', () => {
      expect(splitFileName('notes.tar.gz')).toEqual({
        fileName: 'notes.tar',
        fileExtension: 'gz',
      });
    });

    it('treats a leading dot as part of the name', () => {
      expect(splitFileName('.gitignore')).toEqual({
        fileName: '.gitignore',
        fileExtension: '',
      });
    });

    it('still finds an extension on a dotfile that has one', () => {
      expect(splitFileName('.env.local')).toEqual({
        fileName: '.env',
        fileExtension: 'local',
      });
    });

    it('reports no extension for a trailing dot', () => {
      expect(splitFileName('archive.')).toEqual({
        fileName: 'archive',
        fileExtension: '',
      });
    });
  });
});
