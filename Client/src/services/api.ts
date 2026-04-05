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

// Handle errors — just reject, let components handle gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
