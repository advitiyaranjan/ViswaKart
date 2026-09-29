import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { normalizeIds, readStored, writeStored } from "../lib/commerce";
import { toast } from "sonner";
import api from "../services/api";
interface WishlistContextValue {
  wishlist: string[];
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (id: string) => Promise<void>;
  loading: boolean;
}
const WishlistContext = createContext<WishlistContextValue | null>(null);
const GUEST_KEY = "wishlist";
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const key = user ? `wishlist:${user._id}` : GUEST_KEY;
  const [wishlist, setWishlist] = useState<string[]>(() => normalizeIds(readStored(GUEST_KEY, [])));
  const [loading, setLoading] = useState(false);
  const idsRef = useRef(wishlist);
  const keyRef = useRef(key);
  keyRef.current = key;
  const pending = useRef(new Set<string>());
  const apply = useCallback((ids: string[], storageKey: string) => {
    writeStored(storageKey, ids);
    if (keyRef.current === storageKey) {
      idsRef.current = ids;
      setWishlist(ids);
    }
  }, []);
  useEffect(() => {
    let active = true;
    pending.current.clear();
    const local = normalizeIds(readStored(key, []));
    idsRef.current = local;
    setWishlist(local);
    if (isLoading || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const guest = normalizeIds(readStored(GUEST_KEY, []));
    api
      .put("/auth/wishlist/sync", { ids: guest })
      .then(({ data }) => {
        if (!active) return;
        apply(normalizeIds(data.wishlist), key);
        writeStored(GUEST_KEY, []);
      })
      .catch(() => {
        if (active) toast.error("Couldn't sync your saved items. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, isLoading, user?._id, apply]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        const ids = normalizeIds(readStored(key, []));
        idsRef.current = ids;
        setWishlist(ids);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  const toggleWishlist = useCallback(
    async (id: string) => {
      if (loading || isLoading || pending.current.has(id) || !normalizeIds([id]).length) return;
      const storageKey = key;
      const inList = idsRef.current.includes(id);
      const next = inList ? idsRef.current.filter((item) => item !== id) : [...idsRef.current, id];
      apply(next, storageKey);
      if (!user) return;
      pending.current.add(id);
      try {
        if (inList) await api.delete(`/auth/wishlist/${id}`);
        else await api.post(`/auth/wishlist/${id}`);
      } catch {
        if (keyRef.current === storageKey) {
          const current = idsRef.current;
          apply(inList ? [...new Set([...current, id])] : current.filter((item) => item !== id), storageKey);
          toast.error("Couldn't update your wishlist. Please try again.");
        }
      } finally {
        pending.current.delete(id);
      }
    },
    [key, user?._id, loading, isLoading, apply],
  );
  return (
    <WishlistContext.Provider
      value={{ wishlist, isWishlisted: (id) => wishlist.includes(id), toggleWishlist, loading: loading || isLoading }}
    >
      {children}
    </WishlistContext.Provider>
  );
}
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
