import type { ApiErrorCode, RefreshResponse } from "./types";

export const API_URL: string =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3000/api/v1";

const ACCESS_KEY = "nexus.accessToken";
const REFRESH_KEY = "nexus.refreshToken";

/** Sesion de pestaña: se borra al cerrar la pestana/navegador (no sobrevive al apagar el PC). */
function tokenStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function clearLegacyLocalTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export const tokens = {
  get access(): string | null {
    const store = tokenStore();
    if (!store) return null;
    // Migra fuera de localStorage para que sesiones viejas no reabran solas.
    clearLegacyLocalTokens();
    return store.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    const store = tokenStore();
    if (!store) return null;
    return store.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    const store = tokenStore();
    if (!store) return;
    clearLegacyLocalTokens();
    store.setItem(ACCESS_KEY, access);
    store.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    const store = tokenStore();
    if (!store) return;
    store.removeItem(ACCESS_KEY);
    store.removeItem(REFRESH_KEY);
    clearLegacyLocalTokens();
  },
};

export class ApiError extends Error {
  statusCode: number;
  code: ApiErrorCode | string;
  details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details ?? {};
  }
}

type Options = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function buildUrl(path: string, query?: Options["query"]) {
  const url = `${API_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function rawRequest(path: string, options: Options, accessToken: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "No se pudo contactar el servidor. Verifica que el API esté disponible.",
    );
  }
  return response;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const payload = await parse<{
    statusCode?: number;
    code?: string;
    message?: string | string[];
    details?: Record<string, unknown>;
  }>(response);
  const message = Array.isArray(payload?.message)
    ? payload.message.join(", ")
    : (payload?.message ?? "Ocurrió un error inesperado.");
  return new ApiError(
    payload?.statusCode ?? response.status,
    payload?.code ?? "UNKNOWN",
    message,
    payload?.details ?? {},
  );
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await rawRequest(
        "/auth/refresh",
        { method: "POST", body: { refreshToken }, auth: false },
        null,
      );
      if (!response.ok) return false;
      const data = await parse<RefreshResponse>(response);
      if (!data?.accessToken) return false;
      tokens.set(data.accessToken, data.refreshToken ?? refreshToken);
      return true;
    })().finally(() => {
      // release the lock on the next tick so concurrent callers share this run
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    });
  }
  return refreshPromise;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let response = await rawRequest(path, options, tokens.access);

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await rawRequest(path, options, tokens.access);
    } else {
      tokens.clear();
      onUnauthorized?.();
      throw await toApiError(response);
    }
    if (response.status === 401) {
      tokens.clear();
      onUnauthorized?.();
      throw await toApiError(response);
    }
  }

  if (!response.ok) throw await toApiError(response);
  return parse<T>(response);
}
