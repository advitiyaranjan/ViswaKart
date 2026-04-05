import { createContext, useContext, ReactNode } from "react";
import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/react";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  isAdmin: boolean;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { getToken: clerkGetToken } = useClerkAuth();
  const { signOut, openSignIn, openSignUp } = useClerk();

  // Map Clerk user to the app's User shape
  const user: User | null = isLoaded && isSignedIn && clerkUser
    ? {
        _id: clerkUser.id,
        name: clerkUser.fullName ?? clerkUser.username ?? "",
        email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
        role: (clerkUser.publicMetadata?.role as "user" | "admin") ?? "user",
        avatar: clerkUser.imageUrl,
      }
    : null;

  // login / register open Clerk's hosted modal
  const login = async () => {
    openSignIn();
  };

  const register = async () => {
    openSignUp();
  };

  const logout = () => {
    signOut();
  };

  const updateUser = (_updatedUser: User) => {
    // Profile updates go through Clerk's updateUser or your backend
  };

  const getToken = async (): Promise<string | null> => {
    return clerkGetToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null, // token is retrieved on-demand via getToken()
        isLoading: !isLoaded,
        login,
        register,
        logout,
        updateUser,
        isAdmin: user?.role === "admin",
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
