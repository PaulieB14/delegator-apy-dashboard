const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`apy_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(`apy_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(`apy_cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

export function getCacheAge(key: string): number | null {
  try {
    const raw = localStorage.getItem(`apy_cache_${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return Date.now() - entry.timestamp;
  } catch {
    return null;
  }
}

export function formatCacheAge(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}

export function clearCache(): void {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith("apy_cache_")
  );
  keys.forEach((k) => localStorage.removeItem(k));
}
