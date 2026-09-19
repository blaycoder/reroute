// Client-side API wrapper. It never invents data: a failed call throws, and the
// screen decides what to show (a Retry button, and — after repeated failures —
// a link to the student's own last saved response, if there is one).
//
// The "cache" holds only real responses this student's browser already
// received, keyed by endpoint (and request body for POSTs). It is never
// pre-seeded, so it can only ever replay the student's own data.

const CACHE_PREFIX = "reroute.cache.";

/** The server could not be reached, or failed (network error / 5xx). Retryable. */
export class ApiUnavailableError extends Error {
  constructor(
    readonly path: string,
    options?: { cause?: unknown },
  ) {
    super(`The server could not be reached for ${path}`, options);
    this.name = "ApiUnavailableError";
  }
}

/** The server understood the request and refused it (4xx). Retrying will not help. */
export class ApiRejectedError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRejectedError";
  }
}

export interface ApiFetchOptions {
  /**
   * Save the successful response so it can be replayed if the server later
   * becomes unreachable. Only for reads and idempotent requests — never for
   * answers, which the server must grade.
   */
  cache?: boolean;
}

interface CacheEntry<T> {
  savedAt: string;
  data: T;
}

function cacheKey(path: string, body?: unknown): string {
  return body === undefined
    ? `${CACHE_PREFIX}${path}`
    : `${CACHE_PREFIX}${path}#${JSON.stringify(body)}`;
}

function saveToCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or blocked: the cache is a convenience, never required.
  }
}

/**
 * Save a response you already have (e.g. the progress an answer returned) as
 * the replay copy for a read endpoint, so "cached" stays as fresh as the last
 * thing the student actually saw.
 */
export function cacheResponse<T>(path: string, data: T, body?: unknown): void {
  saveToCache(cacheKey(path, body), data);
}

/** The student's last saved response for this exact request, or null. */
export function readCached<T>(path: string, body?: unknown): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(path, body));
    if (!raw) return null;
    return (JSON.parse(raw) as CacheEntry<T>).data;
  } catch {
    return null;
  }
}

/** Forget everything saved for this browser (used when starting over). */
export function clearCache(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const parsed = (await res.json()) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Non-JSON error body.
  }
  return `The request failed (${res.status})`;
}

export async function apiFetch<T>(
  path: string,
  body?: unknown,
  options: ApiFetchOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      path,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch (cause) {
    throw new ApiUnavailableError(path, { cause });
  }

  if (res.status >= 500) throw new ApiUnavailableError(path);
  if (!res.ok) {
    throw new ApiRejectedError(path, res.status, await readErrorMessage(res));
  }

  const data = (await res.json()) as T;
  if (options.cache) saveToCache(cacheKey(path, body), data);
  return data;
}
