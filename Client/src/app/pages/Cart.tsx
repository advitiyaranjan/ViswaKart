import { Link, useNavigate } from "react-router";
import { ShoppingBag, ArrowRight, Minus, Plus, Trash2, Banknote, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../../context/CartContext";
import { cartSubtotal, reconcileCart, type CatalogSnapshot } from "../../lib/cart";
import { formatCurrency } from "../../lib/currency";
import { productService } from "../../services/productService";
import { Button } from "../components/Button";
import { ProductImage } from "../components/ProductImage";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, replaceItems } = useCart();
  const navigate = useNavigate();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Saved carts can be days old: refresh prices and stock from the catalog once per visit.
  useEffect(() => {
    const ids = itemsRef.current.map((item) => item._id);
    if (!ids.length) return;
    let mounted = true;
    setChecking(true);
    Promise.allSettled(ids.map((id) => productService.getProduct(id))).then((results) => {
      if (!mounted) return;
      const latest: Record<string, CatalogSnapshot | null | undefined> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") latest[ids[index]] = result.value.data.product;
        else if ((result.reason as { response?: { status?: number } })?.response?.status === 404) latest[ids[index]] = null;
      });
      // Apply to the cart as it is now, so quantity changes made while checking are kept.
      const reconciled = reconcileCart(itemsRef.current, latest);
      replaceItems(reconciled.items);
      setNotices(reconciled.notices);
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [replaceItems]);

  const selected = items.filter((item) => !excluded.includes(item._id));
  const subtotal = cartSubtotal(selected);
  const selectedCount = selected.reduce((sum, item) => sum + item.quantity, 0);
  const savings = selected.reduce((sum, item) => sum + Math.max(0, (item.originalPrice ?? item.price) - item.price) * item.quantity, 0);
  const allSelected = selected.length === items.length;

  const toggle = (id: string) => setExcluded((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  const checkout = () => {
    const state = { selectedItemIds: selected.map((item) => item._id) };
    try {
      sessionStorage.setItem("checkout:/checkout", JSON.stringify(state));
    } catch {
      /* optional recovery */
    }
    navigate("/checkout", { state });
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">Your cart</h1>
        {notices.length > 0 && <CartNotices notices={notices} onDismiss={() => setNotices([])} />}
        <div className="rounded-3xl border border-border bg-white px-6 py-20 text-center">
          <ShoppingBag className="mx-auto mb-5 h-12 w-12 text-primary" strokeWidth={1.5} />
          <h2 className="text-2xl font-semibold">Your cart is empty</h2>
          <p className="mb-6 mt-2 text-muted-foreground">Find your favourites and bring them here.</p>
          <Link to="/products">
            <Button size="lg">
              Explore products
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your cart <span className="text-xl font-normal text-muted-foreground">({items.length})</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {checking ? "Checking the latest prices and stock…" : "Prices and availability are confirmed again at checkout."}
        </p>
      </div>

      {notices.length > 0 && <CartNotices notices={notices} onDismiss={() => setNotices([])} />}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Cart items" className="overflow-hidden rounded-2xl border border-border bg-white">
          <label className="flex min-h-12 items-center gap-3 border-b border-border px-5 py-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={allSelected}
              onChange={() => setExcluded(allSelected ? items.map((item) => item._id) : [])}
            />
            Select all <span className="font-normal text-muted-foreground">({selected.length} selected)</span>
          </label>
          {items.map((item) => (
            <article key={item._id} className="flex gap-3 border-b border-border p-4 last:border-b-0 sm:gap-5 sm:p-6">
              <input
                aria-label={`Include ${item.name} in checkout`}
                type="checkbox"
                className="mt-8 size-5 shrink-0 accent-primary"
                checked={!excluded.includes(item._id)}
                onChange={() => toggle(item._id)}
              />
              <Link to={`/products/${item._id}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                <ProductImage
                  src={item.image}
                  alt={item.name}
                  className="h-24 w-20 rounded-xl bg-muted object-contain p-1 sm:h-28 sm:w-28"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link className="line-clamp-2 text-sm font-semibold hover:text-primary sm:text-base" to={`/products/${item._id}`}>
                  {item.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(item.price)} each
                  {item.stock <= 3 && <span className="ml-2 font-medium text-amber-700">Only {item.stock} left</span>}
                </p>
                <p className="mt-2 font-bold">{formatCurrency(item.price * item.quantity)}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center overflow-hidden rounded-xl border border-border">
                    <button
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="grid size-10 place-items-center hover:bg-muted disabled:opacity-40 sm:size-11"
                      disabled={item.quantity <= 1}
                      onClick={() => updateQuantity(item._id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      aria-label={`Increase quantity of ${item.name}`}
                      className="grid size-10 place-items-center hover:bg-muted disabled:opacity-40 sm:size-11"
                      disabled={item.quantity >= item.stock}
                      onClick={() => updateQuantity(item._id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeFromCart(item._id)}
                    className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="rounded-2xl border border-border bg-white p-6 lg:sticky lg:top-36">
          <h2 className="mb-5 text-lg font-semibold">Order summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Subtotal ({selectedCount} item{selectedCount === 1 ? "" : "s"})
              </dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Standard delivery</dt>
              <dd className="font-medium text-primary">Free</dd>
            </div>
          </dl>
          {savings > 0 && (
            <p className="mt-4 rounded-xl bg-primary/5 p-3 text-sm text-primary">You save {formatCurrency(savings)} on these products.</p>
          )}
          <div className="mt-5 flex justify-between border-t border-border pt-5 text-lg font-bold">
            <span>Estimated total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <p className="mb-6 mt-3 text-xs leading-relaxed text-muted-foreground">
            Choose your address and a faster delivery option at checkout.
          </p>
          <Button className="hidden w-full lg:flex" size="lg" disabled={!selected.length} onClick={checkout}>
            Continue to checkout
            <ArrowRight className="size-4" />
          </Button>
          <Link to="/products" className="block py-4 text-center text-sm font-medium text-primary">
            Continue shopping
          </Link>
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Banknote className="size-4" /> Pay in cash when your order arrives
          </p>
        </aside>
      </div>

      {/* Phone checkout bar, sitting above the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="shrink-0">
            <p className="text-xs text-muted-foreground">
              {selectedCount} item{selectedCount === 1 ? "" : "s"}
            </p>
            <p className="text-lg font-bold leading-tight">{formatCurrency(subtotal)}</p>
          </div>
          <Button className="flex-1" disabled={!selected.length} onClick={checkout}>
            Checkout
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CartNotices({ notices, onDismiss }: { notices: string[]; onDismiss: () => void }) {
  return (
    <div role="status" className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <Info className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 font-semibold">We updated your cart</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={onDismiss} className="h-fit rounded-lg px-2 py-1 font-medium hover:bg-amber-100">
        Dismiss
      </button>
    </div>
  );
}
