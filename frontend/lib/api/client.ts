import { ApiError, type ApiErrorBody } from "./types";

// Resolve the API base URL based on whether this code is running server-side
// (Next.js server component, inside the container network) or client-side
// (browser, talking to the host's published port).
//
// - Server: prefer `API_BASE_URL_SERVER` (set in docker env to `http://backend:3001/api/v1`),
//   fall back to `NEXT_PUBLIC_API_BASE_URL`, then to localhost.
// - Client: must use `NEXT_PUBLIC_API_BASE_URL` (browser is on the host, not the container).
function resolveApiBaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";
  const serverUrl = process.env.API_BASE_URL_SERVER;

  // `typeof window === "undefined"` is true only during server-side rendering /
  // server component execution; on the browser it's always defined.
  if (typeof window === "undefined") {
    return serverUrl ?? publicUrl;
  }
  return publicUrl;
}

const API_BASE_URL = resolveApiBaseUrl();

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Extra headers to merge in (e.g. Idempotency-Key). */
  headers?: Record<string, string>;
  /** When true, skip the auto-refresh-on-401 retry. Used by /auth/refresh
   *  itself so it can't recurse if the refresh token is also expired. */
  skipRefresh?: boolean;
}

/**
 * Notifies the AuthContext (if mounted) that the session can no longer be
 * extended. Kept as a noop default so the API client has no hard dependency
 * on React context — `AuthProvider` overrides it at mount time.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

/**
 * Coalesces concurrent 401s so we only call /auth/refresh once even if
 * many in-flight requests expire at the same time.
 */
let refreshInflight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      // Allow the next 401 to start a fresh refresh attempt.
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

async function runFetch(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  let url: URL;
  try {
    url = new URL(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(0, {
      message: "The app isn't configured with a valid API URL.",
      code: "BAD_CONFIG",
    });
  }

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      // Sends the HttpOnly auth cookie and accepts Set-Cookie from the server.
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, {
      message: "Couldn't reach the server. Check your connection and try again.",
      code: "NETWORK_ERROR",
    });
  }

  return response;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(response.status || 0, {
      message: response.ok
        ? "The server sent back something unexpected. Please try again."
        : `Request failed (${response.status}).`,
      code: "BAD_RESPONSE",
    });
  }
}

/**
 * Thin fetch wrapper for the Hajj & Umrah Booking API.
 * – Uses `credentials: "include"` so the browser sends the HttpOnly
 *   JWT cookie set by POST /auth/login automatically.
 * – On a 401 response, attempts a single silent refresh against
 *   /auth/refresh (cookies travel automatically) and retries the
 *   original request once. If the refresh also fails, the 401 is
 *   surfaced and the auth context is asked to sign the user out.
 * – Throws a typed `ApiError` for any non-2xx response so callers can
 *   `catch (e) { if (e instanceof ApiError) ... }`.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipRefresh, ...rest } = options;

  let response = await runFetch(path, rest);

  // Auto-refresh on 401 (browser-only — server-side renders don't have cookies).
  if (
    response.status === 401 &&
    !skipRefresh &&
    typeof window !== "undefined" &&
    // Never try to refresh the refresh endpoint itself, login, or register.
    !/^\/?(auth\/login|auth\/register|auth\/refresh)/.test(path)
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      response = await runFetch(path, rest);
    } else {
      onSessionExpired?.();
    }
  }

  const data = await readBody(response);

  if (!response.ok) {
    // The backend wraps errors as { success: false, error: { code, message } }
    const errorBody = data as
      | { error?: ApiErrorBody; message?: string }
      | undefined;
    const body: ApiErrorBody = errorBody?.error ?? {
      message:
        (errorBody as { message?: string })?.message ||
        response.statusText ||
        "Request failed",
      code: "UNKNOWN",
    };
    throw new ApiError(response.status, body);
  }

  return data as T;
}
