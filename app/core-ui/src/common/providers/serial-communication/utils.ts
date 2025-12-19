export function createPortBoardID(
  portName: string,
  productID?: string,
  vendorID?: string,
  serialNumber?: string,
): string {
  return `${portName}-${productID}-${vendorID}-${serialNumber}`;
}
