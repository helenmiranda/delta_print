export function resolveArteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0]);
    if (typeof parsed === 'string') return parsed;
  } catch {
  }
  return raw;
}
