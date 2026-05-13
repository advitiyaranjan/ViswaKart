import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Heart, ArrowRight } from "lucide-react";
import { productService } from "../../services/productService";
import { useWishlist } from "../../context/WishlistContext";
import { Button } from "../components/Button";
import { CatalogGrid, CatalogMessage, type CatalogProduct } from "../components/CatalogUI";

type LoadResult = { id: string; product: CatalogProduct | null; missing: boolean };

export default function Wishlist() {
  const { wishlist, toggleWishlist, loading: wishlistLoading } = useWishlist();
  const [results, setResults] = useState<LoadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const idsKey = wishlist.join(",");

  useEffect(() => {
    let current = true;
    if (!wishlist.length) {
      setResults([]);
      return;
    }
    // Only fetch products we have not loaded yet; removals are handled locally.
    const known = new Map(results.map((result) => [result.id, result]));
    const missingIds = wishlist.filter((id) => !known.has(id));
    if (!missingIds.length && refresh === 0) {
      setResults(wishlist.map((id) => known.get(id)!));
      return;
    }
    setLoading(true);
    setFailed(false);
    Promise.all(
      missingIds.map((id) =>
        productService
          .getProduct(id)
          .then((res) => ({ id, product: res.data.product as CatalogProduct, missing: false }))
          .catch((err) => {
            if (err?.response?.status === 404) return { id, product: null, missing: true };
            throw err;
          }),
      ),
    )
      .then((loaded) => {
        if (!current) return;
        loaded.forEach((result) => known.set(result.id, result));
        setResults(wishlist.map((id) => known.get(id)).filter((result): result is LoadResult => Boolean(result)));
      })
      .catch(() => current && setFailed(true))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, refresh]);

  const products = results.filter((result) => result.product && wishlist.includes(result.id)).map((result) => result.product!);
  const unavailable = results.filter((result) => result.missing && wishlist.includes(result.id));
  const busy = (loading || wishlistLoading) && products.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Saved for later</p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your wishlist
          {wishlist.length > 0 && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-600">{wishlist.length}</span>
          )}
        </h1>
      </div>

      {failed ? (
        <CatalogMessage
          error
          title="Your saved items couldn't load"
          message="Check your connection and try again."
          onAction={() => setRefresh((value) => value + 1)}
        />
      ) : wishlist.length === 0 && !wishlistLoading ? (
        <div className="rounded-3xl border border-border bg-white px-6 py-20 text-center">
          <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50">
            <Heart className="h-10 w-10 text-rose-400" />
          </span>
          <h2 className="text-xl font-semibold">Nothing saved yet</h2>
          <p className="mx-auto mb-6 mt-2 max-w-xs text-sm text-muted-foreground">
            Tap the heart on any product to keep it here for later.
          </p>
          <Link to="/products">
            <Button size="lg">
              Explore products
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {unavailable.length > 0 && (
            <div
              role="status"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <span>
                {unavailable.length} saved item{unavailable.length === 1 ? " is" : "s are"} no longer available.
              </span>
              <Button variant="outline" size="sm" onClick={() => unavailable.forEach((result) => void toggleWishlist(result.id))}>
                Remove {unavailable.length === 1 ? "it" : "them"}
              </Button>
            </div>
          )}
          <CatalogGrid products={products} loading={busy} skeletons={Math.min(Math.max(wishlist.length, 2), 8)} />
        </>
      )}
    </div>
  );
}
