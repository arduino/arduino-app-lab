function isSubStrInStr(str: unknown, subStr: string): boolean {
  return String(str).toLowerCase().indexOf(subStr.toLowerCase()) !== -1;
}

type FilterableDevice = {
  fqbn: string;
  name: string;
  portName?: string;
};

function filterDeviceListItem<T extends FilterableDevice>(
  item: T,
  filter: string,
  field: keyof T,
): boolean {
  let toFilter = true;
  if (item[field]) {
    const match = isSubStrInStr(item[field], filter);
    toFilter = !match;
  }

  return !toFilter;
}

export function filterDeviceList(filter: string, fromFrom: any[]): any[] {
  const data = fromFrom.filter(
    (item) =>
      filterDeviceListItem(item, filter, 'name') ||
      (item['portName']
        ? filterDeviceListItem(item, filter, 'portName')
        : false),
  );

  return data;
}
