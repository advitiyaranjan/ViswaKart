import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/react";
import api, { setTokenGetter } from "../services/api";
interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
  isSeller?: boolean;
}
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  login: (email?: string, password?: string) => Promise<void>;
  register: (name?: string, email?: string, password?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  isAdmin: boolean;
  getToken: () => Promise<string | null>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { getToken } = useClerkAuth();
  const { signOut, openSignIn, openSignUp } = useClerk();
  const [profile, setProfile] = useState<{ clerkId: string; user: User } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setTokenGetter(getToken);
    return () => setTokenGetter(null);
  }, [getToken]);
  useEffect(() => {
    let active = true;
    setError(null);
    setProfile(null);
    if (!isLoaded || !isSignedIn || !clerkUser?.id) {
      setLoading(false);
      return;
    }
    const clerkId = clerkUser.id;
    setLoading(true);
    getToken()
      .then((token) => api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } }))
      .then(({ data }) => {
        if (active) setProfile({ clerkId, user: data.user });
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "We couldn't load your account. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, clerkUser?.id, getToken, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const user = profile?.clerkId === clerkUser?.id && isSignedIn ? (profile?.user ?? null) : null;
  const updateUser = useCallback((updated: User) => setProfile((current) => (current ? { ...current, user: updated } : current)), []);
  const value = useMemo(
    () => ({
      user,
      token: null,
      isLoading: !isLoaded || loading || Boolean(isSignedIn && !user && !error),
      error,
      retry,
      login: async () => {
        openSignIn();
      },
      register: async () => {
        openSignUp();
      },
      logout: () => {
        void signOut();
      },
      updateUser,
      isAdmin: user?.role === "admin",
      getToken,
    }),
    [user, isLoaded, loading, isSignedIn, error, retry, openSignIn, openSignUp, signOut, updateUser, getToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
