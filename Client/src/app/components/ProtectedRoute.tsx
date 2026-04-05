import { Navigate, Outlet, useLocation } from "react-router";
import { useUser } from "@clerk/react";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  adminOnly?: boolean;
}

export default function ProtectedRoute({ adminOnly = false }: ProtectedRouteProps) {
  const { isSignedIn, isLoaded } = useUser();
  const { isAdmin } = useAuth();
  const location = useLocation();

  if (!isLoaded) return null; // wait for Clerk to init

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

