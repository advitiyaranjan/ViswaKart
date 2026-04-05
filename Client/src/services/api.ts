import axios from "axios";
import { useAuth } from "@clerk/react";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

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

// Handle 401 — redirect to sign-in
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
