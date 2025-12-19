export const ORGANIZATION_HEADER = 'X-Organization';
const CLASSROOM_SHARE_URL = 'https://classroom.google.com/u/0/share';

export function createUUID(): string {
  let dt = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
}

export function buildShareToClassroomURL(
  target: URL,
  title: string,
  body: string,
): string {
  return `
  ${CLASSROOM_SHARE_URL}?url=${encodeURIComponent(
    target.toString(),
  )}&title=${title}&body=${body}
  `;
}
