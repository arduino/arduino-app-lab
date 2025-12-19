import { WebSerialPort } from './ports.type';

export function devicesListAreEquals(
  a: WebSerialPort[],
  b: WebSerialPort[],
): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every(
    (item, index) =>
      b[index].portName === item.portName && b[index].isOpen === item.isOpen,
  );
}
