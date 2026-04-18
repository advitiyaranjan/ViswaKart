import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@clerk/react";
import api from "../services/api";

interface WishlistContextValue {
  wishlist: string[];
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (id: string) => Promise<void>;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const LS_KEY = "wishlist";

function getLocal(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function setLocal(ids: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>(getLocal);
  const [loading, setLoading] = useState(false);

  // On sign-in: merge local wishlist into DB, then use DB as source of truth
  useEffect(() => {
    if (!isSignedIn) {
      // Signed out — use localStorage
      setWishlist(getLocal());
      return;
    }
    setLoading(true);
    const local = getLocal();
    api.put("/auth/wishlist/sync", { ids: local })
      .then((res) => {
        const serverIds: string[] = res.data.wishlist;
        setWishlist(serverIds);
        setLocal(serverIds); // keep local in sync
      })
      .catch(() => {
        // fallback to local if server fails
        setWishlist(getLocal());
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const isWishlisted = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  const toggleWishlist = useCallback(async (id: string) => {
    const inList = wishlist.includes(id);
    const next = inList ? wishlist.filter((x) => x !== id) : [...wishlist, id];
    setWishlist(next);
    setLocal(next);

    if (isSignedIn) {
      try {
        if (inList) await api.delete(`/auth/wishlist/${id}`);
        else await api.post(`/auth/wishlist/${id}`);
      } catch {
        // revert on failure
        setWishlist(wishlist);
        setLocal(wishlist);
      }
    }
  }, [wishlist, isSignedIn]);

  return (
    <WishlistContext.Provider value={{ wishlist, isWishlisted, toggleWishlist, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
