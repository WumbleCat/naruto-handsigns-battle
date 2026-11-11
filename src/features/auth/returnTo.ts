/** Reads and sanitises the `returnTo` query parameter: same-origin paths only. */
export function safeReturnTo(search: string, fallback = '/home'): string {
  const value = new URLSearchParams(search).get('returnTo');
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
