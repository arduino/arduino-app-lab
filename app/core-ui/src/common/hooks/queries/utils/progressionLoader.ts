import { Progression } from '../iot.type';

//Progression Loader for console, creates a string such as "[=====                         ] 18%"
export function progressionLoader(
  current: number,
  total: number = 100,
): string {
  const percentage = getPercentage(current, total);

  const progressBlocks = Math.floor(percentage / 4); // Each block represents 4%
  const emptyBlocks = 25 - progressBlocks; // Total blocks are 25
  const progression = `[${'='.repeat(progressBlocks)}${' '.repeat(
    emptyBlocks,
  )}]  ${percentage}%`;
  return progression;
}

export function getPercentage(
  current: number,
  total: number = 100,
): Progression {
  const percentage = Math.floor((current / total) * 100);

  if (percentage < 0) return 0 as Progression;
  if (percentage > 100) return 100 as Progression;

  return percentage as Progression;
}
