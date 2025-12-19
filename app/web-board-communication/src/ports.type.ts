export type WebSerialPortName = `${string}/${string}`;

export type WebSerialPort = {
  isOpen: boolean;
  portName: string;
  productId: string;
  serialNumber: string;
  vendorId: string;
  portBoardId: string;
  id: string;
  name?: string;
  fqbn?: string;
  architecture?: string;
  isUnknownBoard?: boolean;
  baud?: number;
};

export type WebSerialBoard = {
  usbProductId: number;
  usbVendorId: number;
};
