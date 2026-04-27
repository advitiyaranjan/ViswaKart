import axios from "axios";
import { useAuth } from "@clerk/react";

// Resolve base URL: prefer env, fall back to localhost; ensure absolute URL so dev setups
let _base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
if (!/^https?:\/\//i.test(_base)) {
  // Convert relative values to absolute using window location
  if (typeof window !== "undefined") {
    if (_base.startsWith("//")) {
      _base = window.location.protocol + _base;
    } else if (_base.startsWith(":")) {
      _base = window.location.protocol + "//" + window.location.hostname + _base;
    } else if (_base.startsWith("/")) {
      _base = window.location.origin + _base;
    } else {
      // fallback to localhost if the value is malformed
      _base = "http://localhost:5000/api";
    }
  } else {
    _base = "http://localhost:5000/api";
  }
}

const api = axios.create({
  baseURL: _base,
  headers: { "Content-Type": "application/json" },
});

if (typeof window !== "undefined") {
  // helpful debug during development
  // eslint-disable-next-line no-console
  console.log("[API] baseURL=", api.defaults.baseURL);
}

// Attach Clerk session token to every request
api.interceptors.request.use(async (config) => {
  try {
    // window.__clerkGetToken is set by the ClerkTokenBridge component
    const token = await (window as any).__clerkGetToken?.();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // unauthenticated — continue without token
  }
  return config;
});

// Handle errors — just reject, let components handle gracefully
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Retry-on-429 for idempotent requests (GET/HEAD) with exponential backoff.
    try {
      const config = error.config;
      const status = error.response?.status;
      const method = (config?.method || "").toLowerCase();

      if (status === 429 && config && (method === "get" || method === "head")) {
        config.__retryCount = config.__retryCount || 0;
        const maxRetries = 3;
        if (config.__retryCount < maxRetries) {
          config.__retryCount += 1;

          // Prefer server-specified Retry-After header when available
          const retryAfterHeader = error.response?.headers?.["retry-after"];
          let delay = 1000 * Math.pow(2, config.__retryCount - 1); // 1s, 2s, 4s
          if (retryAfterHeader) {
            const ra = parseInt(String(retryAfterHeader), 10);
            if (!Number.isNaN(ra)) delay = ra * 1000;
          }

          await new Promise((r) => setTimeout(r, delay));
          return api(config);
        }
      }
    } catch (e) {
      // swallow retry-logic errors and fall through to rejection
    }

    return Promise.reject(error);
  }
);

export default api;
