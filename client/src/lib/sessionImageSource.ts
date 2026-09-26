/** Keep private storage images on the app origin, as in the session cockpit. */
export function sessionImageSource(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.pathname === "/api/storage" && url.origin === window.location.origin) {
      const key = url.searchParams.get("key");
      const token = url.searchParams.get("token");
      if (key && token) return `/api/storage-inline?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
    }
  } catch { /* Preserve external and inline references. */ }
  return value;
}
