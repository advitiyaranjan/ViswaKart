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

// Fire login alert email once per session when user becomes authenticated
function LoginEmailBridge() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      const key = `login_alert_sent_${user.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.fullName || user.firstName || email || "there";
      if (email) {
        api.post("/auth/login-alert", { email, name }).catch(() => {});
      }
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
