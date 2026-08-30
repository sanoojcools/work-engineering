import { ApiError, api, getSpecKey } from "../api";

/** Thrown in place of a raw 401 ApiError so callers can show ApiKeyBanner
 * instead of a generic error message. Scout Elevated V2 PR1: every new
 * scout/* call goes through this instead of each component re-reading
 * getSpecKey() itself, per the design doc's "apiFetch adds X-Spec-Key,
 * handles 401 -> ApiKeyBanner" requirement -- this plumbing did not exist
 * before this PR (only WorkUnits/Spec pages had ad hoc per-call keys). */
export class NeedsApiKeyError extends Error {
  constructor() {
    super("Missing or invalid X-Spec-Key");
  }
}

async function withKey<T>(fn: (specKey: string) => Promise<T>): Promise<T> {
  const key = getSpecKey();
  try {
    return await fn(key);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw new NeedsApiKeyError();
    throw err;
  }
}

export const apiFetch = {
  get: <T>(path: string) => withKey((key) => api.get<T>(path, key)),
  post: <T>(path: string, body?: unknown) => withKey((key) => api.post<T>(path, body, key)),
  patch: <T>(path: string, body: unknown) => withKey((key) => api.patch<T>(path, body, key)),
};
