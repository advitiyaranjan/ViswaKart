import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { ArrowLeft, CheckCircle2, MapPin, Plus, ShoppingBag, Truck, Banknote, RefreshCw } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { authService, type AddressData } from "../../services/authService";
import { orderService } from "../../services/orderService";
import { addressSchema } from "../../lib/validationSchemas";
import { DELIVERY_OPTIONS, makeRequestId, shortOrderId, type ShippingMethod } from "../../lib/commerce";
import { formatCurrency } from "../../lib/currency";
import { Button } from "../components/Button";
import { ProductImage } from "../components/ProductImage";

interface Address extends AddressData {
  _id: string;
}

interface Quote {
  items: { product: string; name: string; image: string; price: number; quantity: number }[];
  breakdown: { itemsPrice: number; shippingPrice: number; taxPrice: number; totalPrice: number };
}

const EMPTY_ADDRESS: AddressData = {
  name: "",
  label: "Home",
  phone: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",
  isDefault: false,
};

const ADDRESS_FIELDS: { key: keyof AddressData; label: string; autoComplete: string; wide?: boolean; inputMode?: "tel" | "numeric" }[] = [
  { key: "name", label: "Full name", autoComplete: "name" },
  { key: "phone", label: "Phone number", autoComplete: "tel", inputMode: "tel" },
  { key: "street", label: "Street address", autoComplete: "street-address", wide: true },
  { key: "city", label: "City", autoComplete: "address-level2" },
  { key: "state", label: "State / region", autoComplete: "address-level1" },
  { key: "zipCode", label: "PIN / postal code", autoComplete: "postal-code", inputMode: "numeric" },
  { key: "country", label: "Country", autoComplete: "country-name" },
];

function readSession<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export default function Checkout({ buyNow = false }: { buyNow?: boolean }) {
  const { items, removeItems } = useCart();
  const location = useLocation();
  const [checkoutState] = useState(() => location.state ?? readSession<any>(`checkout:${location.pathname}`));
  const selectedIds: string[] | undefined = checkoutState?.selectedItemIds;
  const requestedItems = buyNow
    ? checkoutState?.product?._id
      ? [{ product: checkoutState.product._id as string, quantity: Number(checkoutState.quantity) || 1 }]
      : []
    : items
        .filter((item) => !selectedIds || selectedIds.includes(item._id))
        .map((item) => ({ product: item._id, quantity: item.quantity }));
  const requestKey = JSON.stringify(requestedItems);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressData>({ ...EMPTY_ADDRESS });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");
  const [retry, setRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [order, setOrder] = useState<{ _id: string; totalPrice: number } | null>(null);
  const submitLock = useRef(false);

  // One idempotency key per cart contents, kept across reloads so a retried submit never double-orders.
  const [requestId] = useState(() => {
    const key = `checkout:request:${location.pathname}`;
    const saved = readSession<{ items: string; id: string }>(key);
    if (saved?.items === requestKey && saved.id) return saved.id;
    const id = makeRequestId();
    try {
      sessionStorage.setItem(key, JSON.stringify({ items: requestKey, id }));
    } catch {
      /* optional */
    }
    return id;
  });

  useEffect(() => {
    let active = true;
    setAddressLoading(true);
    setAddressError("");
    authService
      .getMe()
      .then(({ data }) => {
        if (!active) return;
        const list: Address[] = data.user?.addresses ?? [];
        setAddresses(list);
        setSelectedAddress((current) =>
          list.some((addr) => addr._id === current) ? current : ((list.find((addr) => addr.isDefault) ?? list[0])?._id ?? ""),
        );
        if (!list.length) setShowForm(true);
      })
      .catch((err) => active && setAddressError(err.response?.data?.message || "Couldn't load delivery addresses."))
      .finally(() => active && setAddressLoading(false));
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (order) return;
    let active = true;
    setQuote(null);
    setQuoteError("");
    setQuoteLoading(true);
    const requested = JSON.parse(requestKey);
    if (!requested.length) {
      setQuoteLoading(false);
      return;
    }
    orderService
      .quote({ items: requested, shippingMethod })
      .then(({ data }) => active && setQuote(data))
      .catch((err) => active && setQuoteError(err.response?.data?.message || "Couldn't verify current prices and stock. Please try again."))
      .finally(() => active && setQuoteLoading(false));
    return () => {
      active = false;
    };
  }, [requestKey, shippingMethod, retry, order]);

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setFormErrors({});
    setSaving(true);
    setAddressError("");
    try {
      const { data } = await authService.addAddress(parsed.data);
      const list: Address[] = data.addresses ?? data.user?.addresses ?? [];
      setAddresses(list);
      setSelectedAddress(list.at(-1)?._id ?? "");
      setShowForm(false);
      setForm({ ...EMPTY_ADDRESS });
    } catch (err: any) {
      setAddressError(err.response?.data?.message || "Couldn't save your address. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function placeOrder() {
    const address = addresses.find((value) => value._id === selectedAddress);
    if (!quote || !address || submitLock.current || quoteLoading) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data } = await orderService.createOrder({
        items: requestedItems,
        shippingAddress: address,
        paymentMethod: "cod",
        shippingMethod,
        expectedTotal: quote.breakdown.totalPrice,
        requestId,
      });
      setOrder(data.order);
      if (!buyNow) removeItems(requestedItems.map((item) => item.product));
      try {
        sessionStorage.removeItem(`checkout:${location.pathname}`);
        sessionStorage.removeItem(`checkout:request:${location.pathname}`);
      } catch {
        /* optional storage */
      }
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || "Couldn't place your order. Please try again.");
      if (err.response?.status === 409) setRetry((value) => value + 1);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-3xl border border-border bg-white p-7 text-center sm:p-10">
          <CheckCircle2 className="mx-auto mb-6 size-16 text-primary" />
          <h1 className="text-3xl font-semibold">Order placed!</h1>
          <p className="mt-3 text-muted-foreground">
            Pay {formatCurrency(order.totalPrice)} in cash when it arrives. You can follow its progress in My Orders.
          </p>
          <p className="my-6 break-all rounded-xl bg-muted p-3 font-mono text-sm">Order {shortOrderId(order._id)}</p>
          <Link to="/account#/orders">
            <Button className="w-full">Track my order</Button>
          </Link>
          <Link className="mt-5 block font-medium text-primary" to="/products">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (!requestedItems.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShoppingBag className="mx-auto mb-5 size-14 text-primary" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold">Nothing to check out yet</h1>
        <p className="my-4 text-muted-foreground">Add something to your cart first.</p>
        <Link to={buyNow ? "/products" : "/cart"}>
          <Button>{buyNow ? "Browse products" : "Return to your cart"}</Button>
        </Link>
      </div>
    );
  }

  const canPlace = Boolean(quote) && !quoteLoading && Boolean(selectedAddress) && !submitting && !addressLoading;
  const placeLabel = submitting
    ? "Placing your order…"
    : quote
      ? `Place order · ${formatCurrency(quote.breakdown.totalPrice)}`
      : "Place order";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12 lg:pb-12">
      <Link
        to={buyNow ? "/products" : "/cart"}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Back to {buyNow ? "products" : "your cart"}
      </Link>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">Checkout</h1>
      <p className="mb-8 text-muted-foreground">Confirm where it's going and how fast you'd like it.</p>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-3 text-lg font-semibold">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-white">1</span>
              <MapPin className="size-5 text-primary" />
              Delivery address
            </h2>
            {addressLoading ? (
              <p role="status" className="text-muted-foreground">
                Loading addresses…
              </p>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <label
                    key={addr._id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${selectedAddress === addr._id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1 size-5 shrink-0 accent-primary"
                      checked={selectedAddress === addr._id}
                      onChange={() => setSelectedAddress(addr._id)}
                    />
                    <span className="min-w-0 break-words text-sm">
                      <strong className="mb-1 block">
                        {addr.name || "Delivery address"}
                        {addr.label && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {addr.label}
                          </span>
                        )}
                      </strong>
                      {addr.street}
                      <br />
                      {addr.city}, {addr.state} {addr.zipCode}
                      <br />
                      {addr.country}
                      {addr.phone && <span className="mt-1 block text-muted-foreground">{addr.phone}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {addressError && (
              <p role="alert" className="my-4 text-sm text-destructive">
                {addressError}{" "}
                <button onClick={() => setRetry((value) => value + 1)} className="font-medium underline">
                  Try again
                </button>
              </p>
            )}
            {!showForm ? (
              <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                Add a new address
              </Button>
            ) : (
              <form onSubmit={saveAddress} className="mt-5 space-y-4" noValidate>
                <h3 className="font-semibold">New delivery address</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {ADDRESS_FIELDS.map(({ key, label, autoComplete, wide, inputMode }) => (
                    <div key={key} className={wide ? "sm:col-span-2" : ""}>
                      <label htmlFor={`address-${key}`} className="mb-1.5 block text-sm font-medium">
                        {label}
                      </label>
                      <input
                        id={`address-${key}`}
                        autoComplete={autoComplete}
                        inputMode={inputMode}
                        type={key === "phone" ? "tel" : "text"}
                        value={String(form[key] ?? "")}
                        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                        aria-invalid={!!formErrors[key]}
                        aria-describedby={formErrors[key] ? `error-${key}` : undefined}
                        className={`w-full rounded-xl border bg-white px-3 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 ${formErrors[key] ? "border-destructive" : "border-border"}`}
                      />
                      {formErrors[key] && (
                        <p id={`error-${key}`} className="mt-1 text-xs text-destructive">
                          {formErrors[key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save address"}
                  </Button>
                  {addresses.length > 0 && (
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-3 text-lg font-semibold">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-white">2</span>
              <Truck className="size-5 text-primary" />
              Delivery speed
            </h2>
            <div className="space-y-3">
              {DELIVERY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${shippingMethod === option.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <input
                    type="radio"
                    name="delivery"
                    className="size-5 accent-primary"
                    checked={shippingMethod === option.id}
                    onChange={() => setShippingMethod(option.id)}
                    disabled={submitting}
                  />
                  <span className="flex-1 text-sm">
                    <span className="block font-medium">{option.label}</span>
                    <span className="text-muted-foreground">{option.eta}</span>
                  </span>
                  <span className="text-sm font-semibold">{option.price === 0 ? "Free" : formatCurrency(option.price)}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-2xl border border-border bg-white p-5 sm:p-6 lg:sticky lg:top-36">
          <h2 className="mb-5 text-lg font-semibold">Order summary</h2>
          {quoteLoading ? (
            <p role="status" className="py-5 text-muted-foreground">
              Checking current prices and availability…
            </p>
          ) : quoteError ? (
            <div role="alert">
              <p className="mb-4 text-sm text-destructive">{quoteError}</p>
              <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
                <RefreshCw className="size-4" />
                Try again
              </Button>
              <Link to={buyNow ? "/products" : "/cart"} className="mt-4 block text-sm text-primary">
                {buyNow ? "Back to products" : "Update your cart"}
              </Link>
            </div>
          ) : (
            quote && (
              <>
                <ul className="space-y-4">
                  {quote.items.map((item) => (
                    <li key={item.product} className="flex items-center gap-3">
                      <ProductImage src={item.image} alt={item.name} className="size-14 shrink-0 rounded-xl bg-muted object-contain p-1" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{formatCurrency(quote.breakdown.itemsPrice)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd>{quote.breakdown.shippingPrice ? formatCurrency(quote.breakdown.shippingPrice) : "Free"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4 text-xl font-bold">
                    <dt>Total</dt>
                    <dd>{formatCurrency(quote.breakdown.totalPrice)}</dd>
                  </div>
                </dl>
                <div className="mb-5 mt-5 flex gap-3 rounded-xl bg-primary/5 p-4 text-sm">
                  <Banknote className="size-5 shrink-0 text-primary" />
                  <span>
                    <strong className="block">Cash on delivery</strong>
                    <span className="text-muted-foreground">Pay when you receive your order. You can cancel until it ships.</span>
                  </span>
                </div>
              </>
            )
          )}
          {submitError && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {submitError}
            </p>
          )}
          <Button size="lg" className="hidden w-full lg:flex" disabled={!canPlace} onClick={placeOrder}>
            {placeLabel}
          </Button>
          {!selectedAddress && !addressLoading && (
            <p className="mt-3 text-center text-xs text-muted-foreground">Add or select a delivery address to continue.</p>
          )}
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pt-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto max-w-xl">
          <Button size="lg" className="w-full" disabled={!canPlace} onClick={placeOrder}>
            {placeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
