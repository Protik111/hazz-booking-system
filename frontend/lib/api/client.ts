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
}

/**
 * Thin fetch wrapper for the Hajj & Umrah Booking API.
 * – Uses `credentials: "include"` so the browser sends the HttpOnly
 *   JWT cookie set by POST /auth/login automatically.
 * – Throws a typed `ApiError` for any non-2xx response so callers can
 *   `catch (e) { if (e instanceof ApiError) ... }`.
 */
export async function apiRequest<T>(
  path: string,
  { method = "GET", body, query, headers: extraHeaders = {} }: RequestOptions = {},
): Promise<T> {
  let url: URL;
  try {
    url = new URL(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(0, {
      message: "The app isn't configured with a valid API URL.",
      code: "BAD_CONFIG",
    });
  }

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Sends the HttpOnly auth cookie and accepts Set-Cookie from the server.
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, {
      message: "Couldn't reach the server. Check your connection and try again.",
      code: "NETWORK_ERROR",
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(response.status || 0, {
      message: response.ok
        ? "The server sent back something unexpected. Please try again."
        : `Request failed (${response.status}).`,
      code: "BAD_RESPONSE",
    });
  }

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
