// Defensive list extraction for wc26ir responses. The API wraps lists as
// {games|teams|stadiums:[...]} (verified live), but tolerate a bare array or a generic
// {data|results:[...]} wrapper too, and never throw on unexpected shapes.
export function unwrapList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object') {
    for (const key of ['data', 'games', 'teams', 'stadiums', 'results']) {
      const v = (json as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}
