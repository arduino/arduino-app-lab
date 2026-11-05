// The site a sign-in page is on, for "Waiting for confirmation on github.com"; a value that is no URL is shown as it is.
export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
