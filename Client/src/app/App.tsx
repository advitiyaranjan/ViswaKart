import { RouterProvider } from "react-router";
import { useAuth, useUser } from "@clerk/react";
import { useEffect, useRef } from "react";
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
  const firedRef = useRef(false);

  useEffect(() => {
    if (isSignedIn && user && !firedRef.current) {
      firedRef.current = true;
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.fullName || user.firstName || email || "there";
      if (email) {
        api.post("/auth/login-alert", { email, name }).catch(() => {});
      }
    }
    if (!isSignedIn) firedRef.current = false;
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
