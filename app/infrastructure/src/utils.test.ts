import { AppDetailedInfo, AppStatus } from './orchestrator-api';
import {
  canRenameApp,
  STATUSES_WHERE_RENAME_ALLOWED,
  STATUSES_WHERE_RENAME_FORBIDDEN,
} from './utils';

describe('canRenameApp', () => {
  const createMockApp = (example = false): AppDetailedInfo => ({
    id: 'test-app',
    name: 'Test App',
    status: 'stopped',
    example,
  });

  describe('when app is an example', () => {
    it('should return false regardless of status', () => {
      const exampleApp = createMockApp(true);

      Object.values(STATUSES_WHERE_RENAME_ALLOWED).forEach((status) => {
        expect(canRenameApp(exampleApp, status as AppStatus)).toBe(false);
      });

      Object.values(STATUSES_WHERE_RENAME_FORBIDDEN).forEach((status) => {
        expect(canRenameApp(exampleApp, status as AppStatus)).toBe(false);
      });
    });
  });

  describe('when app is not an example', () => {
    const regularApp = createMockApp(false);

    it('should return true for allowed statuses', () => {
      Object.values(STATUSES_WHERE_RENAME_ALLOWED).forEach((status) => {
        expect(canRenameApp(regularApp, status as AppStatus)).toBe(true);
      });
    });

    it('should return false for forbidden statuses', () => {
      Object.values(STATUSES_WHERE_RENAME_FORBIDDEN).forEach((status) => {
        expect(canRenameApp(regularApp, status as AppStatus)).toBe(false);
      });
    });

    it('should return false when status is undefined', () => {
      expect(canRenameApp(regularApp, undefined)).toBe(false);
    });
  });

  describe('specific state transitions', () => {
    const regularApp = createMockApp(false);

    it('should allow rename when app is stopped', () => {
      expect(canRenameApp(regularApp, 'stopped')).toBe(true);
    });

    it('should allow rename when app is failed', () => {
      expect(canRenameApp(regularApp, 'failed')).toBe(true);
    });

    it('should allow rename when app is uninitialized', () => {
      expect(canRenameApp(regularApp, 'uninitialized')).toBe(true);
    });

    it('should forbid rename when app is starting', () => {
      expect(canRenameApp(regularApp, 'starting')).toBe(false);
    });

    it('should forbid rename when app is running', () => {
      expect(canRenameApp(regularApp, 'running')).toBe(false);
    });

    it('should forbid rename when app is stopping', () => {
      expect(canRenameApp(regularApp, 'stopping')).toBe(false);
    });
  });
});
