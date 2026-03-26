import { del, get, set } from 'idb-keyval';
import { useCallback } from 'react';

const USED_SERIAL_NUMBERS_KEY = 'arduino:used-serial-numbers';
const LAST_CONNECTIONS_KEY = 'arduino:last-connections';

export interface BoardConnectionInfo {
  serial: string;
  lastConnection: string; // ISO date string
}

export interface BoardSerialTracker {
  isBoardNew: (serial: string) => Promise<boolean>;
  markBoardAsUsed: (serial: string) => Promise<void>;
  getUsedSerialNumbers: () => Promise<string[]>;
  clearUsedSerialNumbers: () => Promise<void>;
  clearBoardAsUsed: (serial: string) => Promise<void>;
  updateLastConnection: (serial: string) => Promise<void>;
  getLastConnection: (serial: string) => Promise<string | null>;
  getAllLastConnections: () => Promise<BoardConnectionInfo[]>;
}

export const useBoardSerialTracker = (): BoardSerialTracker => {
  const isBoardNew = async (serial: string): Promise<boolean> => {
    if (!serial) return false;

    try {
      const usedSerialNumbers =
        (await get<string[]>(USED_SERIAL_NUMBERS_KEY)) || [];
      return !usedSerialNumbers.includes(serial);
    } catch (error) {
      console.error('Error checking if board is new:', error);
      return false;
    }
  };

  const markBoardAsUsed = async (serial: string): Promise<void> => {
    if (!serial) return;

    try {
      const usedSerialNumbers =
        (await get<string[]>(USED_SERIAL_NUMBERS_KEY)) || [];
      if (!usedSerialNumbers.includes(serial)) {
        usedSerialNumbers.push(serial);
        await set(USED_SERIAL_NUMBERS_KEY, usedSerialNumbers);
      }
    } catch (error) {
      console.error('Error marking board as used:', error);
    }
  };

  const getUsedSerialNumbers = async (): Promise<string[]> => {
    try {
      return (await get<string[]>(USED_SERIAL_NUMBERS_KEY)) || [];
    } catch (error) {
      console.error('Error getting used serial numbers:', error);
      return [];
    }
  };

  const clearUsedSerialNumbers = async (): Promise<void> => {
    try {
      await del(USED_SERIAL_NUMBERS_KEY);
    } catch (error) {
      console.error('Error clearing used serial numbers:', error);
    }
  };

  const clearBoardAsUsed = async (serial: string): Promise<void> => {
    if (!serial) return;

    try {
      const usedSerialNumbers =
        (await get<string[]>(USED_SERIAL_NUMBERS_KEY)) || [];
      const updatedSerialNumbers = usedSerialNumbers.filter(
        (s) => s !== serial,
      );
      await set(USED_SERIAL_NUMBERS_KEY, updatedSerialNumbers);
    } catch (error) {
      console.error('Error clearing board as used:', error);
    }
  };

  const updateLastConnection = useCallback(
    async (serial: string): Promise<void> => {
      if (!serial) return;

      try {
        const lastConnections =
          (await get<BoardConnectionInfo[]>(LAST_CONNECTIONS_KEY)) || [];
        const now = new Date().toISOString();

        const existingIndex = lastConnections.findIndex(
          (conn) => conn.serial === serial,
        );
        if (existingIndex >= 0) {
          lastConnections[existingIndex].lastConnection = now;
        } else {
          lastConnections.push({ serial, lastConnection: now });
        }

        await set(LAST_CONNECTIONS_KEY, lastConnections);
      } catch (error) {
        console.error('Error updating last connection:', error);
      }
    },
    [],
  );

  const getLastConnection = async (serial: string): Promise<string | null> => {
    if (!serial) return null;

    try {
      const lastConnections =
        (await get<BoardConnectionInfo[]>(LAST_CONNECTIONS_KEY)) || [];
      const connection = lastConnections.find((conn) => conn.serial === serial);
      return connection ? connection.lastConnection : null;
    } catch (error) {
      console.error('Error getting last connection:', error);
      return null;
    }
  };

  const getAllLastConnections = async (): Promise<BoardConnectionInfo[]> => {
    try {
      return (await get<BoardConnectionInfo[]>(LAST_CONNECTIONS_KEY)) || [];
    } catch (error) {
      console.error('Error getting all last connections:', error);
      return [];
    }
  };

  return {
    isBoardNew,
    markBoardAsUsed,
    getUsedSerialNumbers,
    clearUsedSerialNumbers,
    clearBoardAsUsed,
    updateLastConnection,
    getLastConnection,
    getAllLastConnections,
  };
};
