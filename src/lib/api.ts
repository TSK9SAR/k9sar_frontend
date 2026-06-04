// src/lib/api.ts

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export type ApiFetchOptions = RequestInit & {
  authRequired?: boolean;
  mfaRequired?: boolean;
  redirectOnAuthFailure?: boolean;
};

export class ApiError extends Error {
  status: number;
  response: Response;
  data: unknown;

  constructor(message: string, response: Response, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = response.status;
    this.response = response;
    this.data = data;
  }
}

function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("twofa_token");
  window.dispatchEvent(new Event("auth:logout"));
}

function clearMfaStateOnly() {
  localStorage.removeItem("twofa_token");
  window.dispatchEvent(new Event("auth:changed"));
}

function isMfaError(detail: unknown) {
  if (typeof detail !== "string") return false;
  const s = detail.toLowerCase();
  return s.includes("mfa") || s.includes("2fa") || s.includes("multi-factor");
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

async function readJsonSafe(response: Response) {
  return response.clone().json().catch(() => null);
}

/**
 * Fetch-compatible API wrapper.
 *
 * This intentionally returns the raw Response so old code can migrate safely:
 *
 *   const res = await apiFetch("/auth/me", { authRequired: true });
 *   const data = await res.json();
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const {
    authRequired = false,
    mfaRequired = false,
    redirectOnAuthFailure = true,
    ...fetchOptions
  } = options;

  const token = localStorage.getItem("token");

  if (authRequired && !token) {
    clearAuthState();

    if (redirectOnAuthFailure) {
      window.location.href = "/login";
    }

    throw new Error("Authentication required");
  }

  const headers = new Headers(fetchOptions.headers || {});

  if (!headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401) {
    const data = await readJsonSafe(response);

    clearAuthState();

    if (authRequired && redirectOnAuthFailure) {
      window.location.href = "/login";
    }

    throw new ApiError("Authentication expired", response, data);
  }

  if (response.status === 403) {
    const data = await readJsonSafe(response);
    const detail = (data as any)?.detail;

    if (mfaRequired || isMfaError(detail)) {
      clearMfaStateOnly();

      throw new ApiError(
        typeof detail === "string" ? detail : "MFA required or expired",
        response,
        data
      );
    }

    throw new ApiError(
      typeof detail === "string" ? detail : "Forbidden",
      response,
      data
    );
  }

  return response;
}

/**
 * Convenience helper for new code.
 *
 * Use this where you want parsed JSON directly.
 */
export async function apiJson<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    const data = await readJsonSafe(response);
    const detail = (data as any)?.detail;

    throw new ApiError(
      typeof detail === "string"
        ? detail
        : `API request failed: ${response.status}`,
      response,
      data
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}