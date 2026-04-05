import { RouterProvider } from "react-router";
import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { router } from "./routes";

// Bridge Clerk's getToken to the axios interceptor
function ClerkTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    (window as any).__clerkGetToken = getToken;
    return () => { delete (window as any).__clerkGetToken; };
  }, [getToken]);
  return null;
}

export default function App() {
  return (
    <>
      <ClerkTokenBridge />
      <RouterProvider router={router} />
    </>
  );
}
