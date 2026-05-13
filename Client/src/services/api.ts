import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

/** Normalises VITE_API_URL (absolute, relative or missing) to an absolute URL ending in `/api`. */
export function resolveApiBase(value: string | undefined, origin: string) {
  const url = new URL(value?.trim() || "/api", origin);
  if (!/^https?:$/.test(url.protocol)) throw new Error("VITE_API_URL must be an HTTP(S) URL");
  url.pathname = `${url.pathname.replace(/\/+$/, "").replace(/\/api$/, "")}/api`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

const MAX_RETRIES = 3;

/** Delay before retrying a rate-limited request: the server's Retry-After, else 1s, 2s, 4s. */
export function retryDelay(attempt: number, retryAfter?: unknown) {
  const seconds = Number.parseInt(String(retryAfter ?? ""), 10);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 30) * 1000;
  return 1000 * 2 ** (attempt - 1);
}

let tokenGetter: (() => Promise<string | null>) | null = null;
export function setTokenGetter(getter: typeof tokenGetter) {
  tokenGetter = getter;
}

const api = axios.create({
  baseURL: resolveApiBase(import.meta.env.VITE_API_URL, typeof window === "undefined" ? "http://localhost:5000" : window.location.origin),
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenGetter?.();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Retry idempotent requests that hit the rate limiter; writes are never retried automatically.
api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { __retryCount?: number }) | undefined;
  const method = config?.method?.toLowerCase();
  if (error.response?.status !== 429 || !config || (method !== "get" && method !== "head")) throw error;
  config.__retryCount = (config.__retryCount ?? 0) + 1;
  if (config.__retryCount > MAX_RETRIES) throw error;
  await new Promise((resolve) => setTimeout(resolve, retryDelay(config.__retryCount!, error.response?.headers?.["retry-after"])));
  return api(config);
});

export default api;
