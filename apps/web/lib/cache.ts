// Cache wrappers + TTL budget (PLAN.md §6: Upstash free 10k cmds/day — budget every key).
//
// Uses Upstash Redis via its REST API when UPSTASH_REDIS_REST_URL/_TOKEN are set.
// Otherwise falls back to an in-process Map so the app runs locally with no creds.
// Only a tiny get/setJson/getJson surface is needed for Phase 1; no SDK dependency.

import 'server-only';

const URL_BASE = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const CACHE_BACKEND: 'upstash' | 'memory' = URL_BASE && TOKEN ? 'upstash' : 'memory';

// Centralized key names + TTLs so the Redis command budget stays auditable.
export const CACHE_KEYS = {
  liveSnapshot: 'wc26:live:snapshot',
} as const;

export const TTL = {
  /** Live snapshot: short, refreshed by the poll route during live windows. */
  liveSnapshot: 60,
} as const;

// ---- in-memory fallback -----------------------------------------------------
type MemEntry = { value: string; expiresAt: number | null };
// Survives module reloads within a single dev process via globalThis.
const mem: Map<string, MemEntry> =
  (globalThis as { __wc26mem?: Map<string, MemEntry> }).__wc26mem ??
  ((globalThis as { __wc26mem?: Map<string, MemEntry> }).__wc26mem = new Map());

function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt != null && e.expiresAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return e.value;
}

function memSet(key: string, value: string, ttlSeconds?: number): void {
  mem.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

// ---- upstash REST -----------------------------------------------------------
async function upstash(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_BASE!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`upstash: ${json.error}`);
  return json.result;
}

// ---- public surface ---------------------------------------------------------
export async function get(key: string): Promise<string | null> {
  if (CACHE_BACKEND === 'memory') return memGet(key);
  return ((await upstash(['GET', key])) as string | null) ?? null;
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (CACHE_BACKEND === 'memory') return memSet(key, value, ttlSeconds);
  if (ttlSeconds) await upstash(['SET', key, value, 'EX', ttlSeconds]);
  else await upstash(['SET', key, value]);
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  await set(key, JSON.stringify(value), ttlSeconds);
}
