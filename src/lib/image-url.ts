export function getDisplayImageUrl(imageUrl: string, source: string): string {
  if (source === 'fbi' && imageUrl.startsWith('https://www.fbi.gov/')) {
    return `/api/fbi-image?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}
