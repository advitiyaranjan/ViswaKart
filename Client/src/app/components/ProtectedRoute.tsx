import { Navigate, Outlet, useLocation } from "react-router";
import { useUser } from "@clerk/react";
import { useAuth } from "../../context/AuthContext";
import { useEffect } from "react";
export default function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { isSignedIn, isLoaded } = useUser();
  const { isAdmin, isLoading, error, retry } = useAuth();
  const location = useLocation();
  useEffect(() => {
    if (location.state && ["/buy-now", "/checkout"].includes(location.pathname)) {
      try {
        sessionStorage.setItem(`checkout:${location.pathname}`, JSON.stringify(location.state));
      } catch {
        /* optional recovery */
      }
    }
  }, [location]);
  if (!isLoaded || (isSignedIn && isLoading))
    return (
      <div role="status" className="p-12 text-center text-muted-foreground">
        Loading your account…
      </div>
    );
  if (!isSignedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (error)
    return (
      <div role="alert" className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold mb-3">Account unavailable</h1>
        <p>{error}</p>
        <button className="mt-5 px-5 py-3 bg-primary text-white rounded-xl" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
