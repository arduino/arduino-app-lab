import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  boardNeedsImageUpdate,
  getBoardName,
  getBoards,
  getKeyboardLayout,
  isUserPasswordSet,
  listKeyboardLayouts,
  selectBoard,
  setBoardName,
  setBoardService,
  setKeyboardLayout,
  setUserPassword,
} from './boardService.impl';
import { MockBoardService } from './boardService.mock';

beforeAll(() => {
  setBoardService(MockBoardService);
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('boardService.impl + MockBoardService – getBoards', () => {
  it('getBoards ritorna le board mockate (Pippo, Pluto, Paperino)', async () => {
    const boards = await getBoards();

    expect(Array.isArray(boards)).toBe(true);
    expect(boards.length).toBe(3);
    const byId = [...boards].sort((a, b) => Number(a.id) - Number(b.id));

    expect(byId[0]).toMatchObject({
      id: '1',
      name: 'Pippo',
      type: 'Arduino Uno Q',
      connectionType: 'USB',
      protocol: 'serial',
    });

    expect(byId[1]).toMatchObject({
      id: '2',
      name: 'Pluto',
      type: 'Arduino Uno Q',
      connectionType: 'USB',
      protocol: 'serial',
    });

    expect(byId[2]).toMatchObject({
      id: '3',
      name: 'Paperino',
      type: 'Arduino Uno Q',
      connectionType: 'USB',
      protocol: 'serial',
    });
  });
});

describe('boardService.impl + MockBoardService – selectBoard / boardName', () => {
  it('selectBoard imposta il boardName uguale al nome della board selezionata', async () => {
    const boards = await getBoards();
    const target = boards[1];

    await selectBoard(target.serial);

    const name = await getBoardName();
    expect(name).toBe(target.name);
  });

  it('setBoardName aggiorna boardName e la board selezionata', async () => {
    const boards = await getBoards();
    const target = boards[0];
    await selectBoard(target.serial);
    await setBoardName('NuovoNome');

    const name = await getBoardName();
    expect(name).toBe('NuovoNome');

    const updatedBoards = await getBoards();
    const updated = updatedBoards.find((b) => b.serial === target.serial);
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('NuovoNome');
  });
});

describe('boardService.impl + MockBoardService – keyboard layout', () => {
  it('getKeyboardLayout parte da "default" e cambia con setKeyboardLayout', async () => {
    const initial = await getKeyboardLayout();
    expect(initial).toBe('default');

    await setKeyboardLayout('it-IT');

    const updated = await getKeyboardLayout();
    expect(updated).toBe('it-IT');
  });

  it('listKeyboardLayouts restituisce la lista mockata (di default vuota)', async () => {
    const layouts = await listKeyboardLayouts();
    expect(Array.isArray(layouts)).toBe(true);
    expect(layouts).toEqual([]);
  });
});

describe('boardService.impl + MockBoardService – user password', () => {
  it('dopo setUserPassword, isUserPasswordSet restituisce true', async () => {
    await setUserPassword('super-secret');

    const result = await isUserPasswordSet();
    expect(result).toBe(true);
  });
});

describe('boardService.impl + MockBoardService – boardNeedsImageUpdate', () => {
  it('boardNeedsImageUpdate restituisce il valore fisso del mock (false)', async () => {
    const result = await boardNeedsImageUpdate();
    expect(result).toBe(false);
  });
});
