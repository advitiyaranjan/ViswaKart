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
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
