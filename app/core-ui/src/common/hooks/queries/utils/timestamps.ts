/** Takes timestamps and returns it as [hh:mm:ss] (the "[]" are included on the return string)*/
export const formatTimestamp = (timestamp?: string): string => {
  const regex = /T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z/;
  const match = timestamp?.match(regex);
  return match ? `[${match[1]}]` : '';
};

export const timeElapsedFromNowMs = (timestamp: string): number => {
  const date1 = new Date(timestamp);
  const now = new Date();

  return Math.abs(date1.getTime() - now.getTime());
};
