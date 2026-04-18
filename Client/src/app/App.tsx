import { RouterProvider } from "react-router";
import { useAuth, useUser } from "@clerk/react";
import { useEffect } from "react";
import { router } from "./routes";
import api from "../services/api";

// Bridge Clerk's getToken to the axios interceptor
function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    (window as any).__clerkGetToken = getToken;
    return () => { delete (window as any).__clerkGetToken; };
  }, [getToken]);
  return null;
}

// Fire login alert email only on actual sign-in (not refresh or new tab)
function LoginEmailBridge() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isSignedIn === undefined) return; // Clerk still loading

    if (isSignedIn && user) {
      const key = `lga_${user.id}`; // lga = login_alert
      if (localStorage.getItem(key)) return; // already sent since last logout
      localStorage.setItem(key, "1");
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.fullName || user.firstName || email || "there";
      if (email) {
        api.post("/auth/login-alert", { email, name }).catch(() => {});
      }
    }

    if (isSignedIn === false && user === null) {
      // User signed out — clear all lga_ flags so next login fires the email
      Object.keys(localStorage)
        .filter((k) => k.startsWith("lga_"))
        .forEach((k) => localStorage.removeItem(k));
    }
  }, [isSignedIn, user]);

  return null;
}

export default function App() {
  return (
    <>
      <ClerkTokenBridge />
      <LoginEmailBridge />
      <RouterProvider router={router} />
    </>
  );
}
