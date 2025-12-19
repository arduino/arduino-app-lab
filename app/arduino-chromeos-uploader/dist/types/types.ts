export type PortName = `${string}/${string}`;
export type WebSerialPortName = `${string}/${string}`;

export type BoardDescriptor = {
  name: PortName;
  vendorId: string;
  productId: string;
  fqbn: string;
  isOpen: boolean;
};

export class Logger {}

export type UploadPayload = {} 

export const UNKNOWN_BOARD_NAME = 'Unknown';

export class Uploader {
  logger: Logger = new Logger();
  filters: unknown[] = [];
  whiteListedOrigins: string[] = [];
  constructor({
    logger = new Logger(),
    filters = [],
    whiteListedOrigins = [] as string[],
  }) {
    console.log(`Initializing mock uploader with ${logger}, ${JSON.stringify(filters)}, ${whiteListedOrigins}`);
  }

  onMessage(handler: any): void {
  }

  listBoards(): any[] {
    return [];
  }

  openPorts: Record<string, boolean> = {}

  async openPort({ name, baudrate }: { name: string, baudrate: number }) {
    return null;
  } 
  
  async closePort({name}: {name: WebSerialPortName}) {
    return
  }

  async writePort({name, data }: {name: string, data: string}) {
    return
  }

  
  async upload(uploadPayload: UploadPayload) {
  }
  
};

