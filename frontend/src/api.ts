export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.body) as { detail?: unknown };
      if (typeof parsed.detail === "string") return parsed.detail;
      if (Array.isArray(parsed.detail)) {
        return parsed.detail
          .map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : JSON.stringify(item)))
          .join("; ");
      }
    } catch {
      if (err.body) return err.body;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Request failed";
}

const SPEC_KEY = "we-spec-key";

export function getSpecKey(): string {
  try {
    return localStorage.getItem(SPEC_KEY) || "dev-spec-key-change-me";
  } catch {
    return "dev-spec-key-change-me";
  }
}

export function setSpecKey(value: string): void {
  localStorage.setItem(SPEC_KEY, value);
}

async function request<T>(path: string, init: RequestInit & { specKey?: string } = {}): Promise<T> {
  const { specKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (specKey) headers.set("X-Spec-Key", specKey);
  const response = await fetch(`/api${path}`, { ...rest, headers });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, text);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  get: <T>(path: string, specKey?: string) => request<T>(path, { specKey }),
  post: <T>(path: string, body?: unknown, specKey?: string) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), specKey }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, specKey?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), specKey }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
};
