import { describe, expect, it } from 'vitest';

import { formatToolTitle, mcpToolName } from './formatToolTitle';

// Reading only Claude's spelling showed OpenCode's raw tool name in the permission dialog.
describe('formatToolTitle', () => {
  it('labels a board tool in either engine spelling', () => {
    for (const title of [
      'mcp__arduino-board__apps_list',
      'arduino-board_apps_list',
    ]) {
      expect(formatToolTitle(title)).toBe('List apps');
      expect(mcpToolName(title)).toBe('apps_list');
    }
  });

  // A tool's own underscores survive the prefix strip, whether it is mapped or spelled out.
  it('keeps the tool name behind the prefix', () => {
    expect(formatToolTitle('arduino-board_sketch_libraries_add')).toBe(
      'Add sketch library',
    );
    expect(formatToolTitle('arduino-board_future_tool_nobody_mapped')).toBe(
      'Future tool nobody mapped',
    );
  });

  // A native tool is not an MCP one: its title is the engine's own text and must survive.
  it('leaves a native tool alone', () => {
    expect(mcpToolName('Edit')).toBeNull();
    expect(mcpToolName('apps_list')).toBeNull();
    expect(formatToolTitle('Edit')).toBe('Edit');
  });

  // The prefix is the server's name, so a tool of the same name from elsewhere keeps its own.
  it('only strips the board server prefix', () => {
    expect(mcpToolName('mcp__other-server__apps_list')).toBe('apps_list');
    expect(mcpToolName('arduino-boardapps_list')).toBeNull();
  });
});
