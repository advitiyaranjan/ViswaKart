import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Zap,
  MapPin,
  Truck,
  Lock,
  ChevronLeft,
  CheckCircle2,
  Home,
  Briefcase,
  Plus,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authService, AddressData } from "../../services/authService";
import { addressSchema } from "../../lib/validationSchemas";
import api from "../../services/api";
import { Button } from "../components/Button";
import { formatCurrency } from "../../lib/currency";

const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Delivery options ─────────────────────────────────────────────────────────
const DELIVERY_OPTIONS = [
  { id: "standard", label: "Standard Delivery", days: "5–7 business days", price: 0 },
  { id: "express", label: "Express Delivery", days: "2–3 business days", price: 12.99 },
  { id: "overnight", label: "Overnight", days: "Next business day", price: 24.99 },
];

// ─── Stripe payment form ───────────────────────────────────────────────────────
interface PayFormProps {
  clientSecret: string;
  paymentIntentId: string;
  shippingAddress: object;
  breakdown: { itemsPrice: number; shippingPrice: number; taxPrice: number; totalPrice: number };
  buyNowItems: { product: string; quantity: number }[];
  onSuccess: (orderId: string) => void;
}

function PaymentForm({ clientSecret, paymentIntentId, shippingAddress, breakdown, buyNowItems, onSuccess }: PayFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError("");

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try again.");
      setPaying(false);
      return;
    }

    try {
      const res = await api.post("/payments/confirm-order", {
        paymentIntentId,
        items: buyNowItems,
        shippingAddress,
        breakdown,
      });
      onSuccess(res.data.order._id);
    } catch {
      setError("Payment succeeded but order creation failed. Contact support.");
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}
      <Button type="submit" variant="primary" className="w-full" size="lg" disabled={!stripe || paying}>
        {paying ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
            </svg>
            Processing payment…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="w-4 h-4" /> Pay & Place Order
          </span>
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> 256-bit SSL encrypted · Powered by Stripe
      </p>
    </form>
  );
}

// ─── Saved address card ────────────────────────────────────────────────────────
interface SavedAddress {
  _id: string;
  label: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

// ─── Main BuyNow page ──────────────────────────────────────────────────────────
export default function BuyNow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    product: { _id: string; name: string; price: number; image: string; stock: number };
    quantity: number;
  } | null;

  const product = state?.product;
  const quantity = state?.quantity ?? 1;

  const [step, setStep] = useState<"address" | "payment">("address");
  const [delivery, setDelivery] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cod">("card");

  // Address state
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressData>({
    label: "Home", phone: "", street: "", city: "", state: "", zipCode: "", country: "", isDefault: false,
  });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [initError, setInitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!product) { navigate("/products"); return; }
    if (!user) { navigate("/login", { state: { from: location } }); return; }
    setAddrLoading(true);
    authService.getMe().then((res) => {
      const addrs: SavedAddress[] = res.data.user?.addresses ?? [];
      setSavedAddresses(addrs);
      const def = addrs.find((a) => a.isDefault) ?? addrs[0];
      if (def) setSelectedAddrId(def._id);
    }).catch(() => {}).finally(() => setAddrLoading(false));
  }, []);

  if (!product) return null;

  const selectedAddr = savedAddresses.find((a) => a._id === selectedAddrId);
  const deliveryOption = DELIVERY_OPTIONS.find((d) => d.id === delivery)!;
  const shippingCost = deliveryOption.price;
  const itemsPrice = product.price * quantity;
  const taxPrice = parseFloat(((itemsPrice + shippingCost) * 0.08).toFixed(2));
  const totalPrice = parseFloat((itemsPrice + shippingCost + taxPrice).toFixed(2));

  const handleProceedToPayment = async () => {
    if (!selectedAddr) return;
    setPayLoading(true);
    setInitError("");
    try {
      if (paymentMethod === "card") {
        const res = await api.post("/payments/create-intent", {
          items: [{ product: product._id, quantity }],
          shippingPrice: shippingCost,
          couponDiscount: 0,
        });
        setClientSecret(res.data.clientSecret);
        setPaymentIntentId(res.data.paymentIntentId);
        setBreakdown(res.data.breakdown ?? { itemsPrice, shippingPrice: shippingCost, taxPrice, totalPrice });
        setStep("payment");
      } else {
        // Cash on Delivery: create order directly
        const res = await api.post("/orders", {
          items: [{ product: product._id, quantity }],
          shippingAddress: selectedAddr,
          paymentMethod: "cod",
          shippingPrice: shippingCost,
        });
        setOrderId(res.data.order._id);
        setSuccess(true);
      }
    } catch (e) {
      setInitError("Failed to initialise payment. Please try again.");
    } finally {
      setPayLoading(false);
    }
  };

  const handleSuccess = (id: string) => {
    setOrderId(id);
    setSuccess(true);
  };

  const handleSaveAddress = async () => {
    const result = addressSchema.safeParse(addrForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      (result.error?.errors ?? []).forEach((e) => { if (e.path && e.path.length > 0) errs[String(e.path[0])] = e.message; });
      setAddrErrors(errs);
      return;
    }
    setAddrErrors({});
    setAddrSaving(true);
    try {
      const res = await authService.addAddress(addrForm);
      const raw = res?.data?.addresses ?? res?.data?.user?.addresses;
      const newAddrs: SavedAddress[] = Array.isArray(raw) ? raw : [];
      setSavedAddresses(newAddrs);
      const newest = newAddrs[newAddrs.length - 1];
      if (newest) setSelectedAddrId(newest._id);
      setShowAddForm(false);
      setAddrForm({ label: "Home", phone: "", street: "", city: "", state: "", zipCode: "", country: "", isDefault: false });
    } catch {
      /* ignore */
    } finally {
      setAddrSaving(false);
    }
  };

  // ── Success ──────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-border shadow-xl p-10 max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Order Placed!</h1>
          <p className="text-muted-foreground text-sm">
            Your payment was successful and your order is confirmed. We'll send you updates as it ships.
          </p>
          {orderId && (
            <p className="text-xs font-mono bg-slate-100 rounded-lg px-3 py-2">
              Order ID: #{orderId.slice(-10).toUpperCase()}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/products">
              <Button variant="primary" className="w-full">Continue Shopping</Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">View My Orders</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => step === "payment" ? setStep("address") : navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Zap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Buy Now</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Address / Payment */}
        <div className="lg:col-span-3 space-y-4">

          {step === "address" && (
            <>
              {/* Delivery address */}
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Delivery Address
                </h2>

                {addrLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
                  </div>
                ) : savedAddresses.length === 0 && !showAddForm ? (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add a delivery address
                  </button>
                ) : (
                  <div className="space-y-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr._id}
                        onClick={() => setSelectedAddrId(addr._id)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedAddrId === addr._id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {addr.label === "Home" ? <Home className="w-3.5 h-3.5 text-primary" /> : <Briefcase className="w-3.5 h-3.5 text-primary" />}
                          <span className="text-xs font-semibold">{addr.label}</span>
                          {addr.isDefault && <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full">Default</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{addr.street}, {addr.city}, {addr.state} {addr.zipCode}, {addr.country}</p>
                        {addr.phone && <p className="text-xs text-muted-foreground">📞 {addr.phone}</p>}
                      </button>
                    ))}
                    {!showAddForm && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full flex items-center gap-2 text-xs text-primary hover:underline py-1 px-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add new address
                      </button>
                    )}
                  </div>
                )}

                {showAddForm && (
                  <div className="border border-border rounded-xl p-4 space-y-3 bg-slate-50">
                    <p className="text-xs font-semibold">New Address</p>
                    <div className="flex gap-2">
                      {["Home", "Work", "Other"].map((l) => (
                        <button key={l} type="button" onClick={() => setAddrForm((f) => ({ ...f, label: l }))}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            addrForm.label === l ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
                          }`}
                        >{l}</button>
                      ))}
                    </div>
                    <div>
                      <input className={inputCls} placeholder="Phone Number *" value={addrForm.phone ?? ""} onChange={(e) => { setAddrForm((f) => ({ ...f, phone: e.target.value })); setAddrErrors((p) => ({ ...p, phone: "" })); }} />
                      {addrErrors.phone ? <p className="text-destructive text-[10px]">{addrErrors.phone}</p> : <p className="text-muted-foreground text-[10px]">e.g. 9876543210</p>}
                    </div>
                    <input className={inputCls} placeholder="Street address *" value={addrForm.street} onChange={(e) => setAddrForm((f) => ({ ...f, street: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="City *" value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                      <input className={inputCls} placeholder="State *" value={addrForm.state} onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="ZIP / Pincode *" value={addrForm.zipCode} onChange={(e) => setAddrForm((f) => ({ ...f, zipCode: e.target.value }))} />
                      <input className={inputCls} placeholder="Country *" value={addrForm.country} onChange={(e) => setAddrForm((f) => ({ ...f, country: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={handleSaveAddress} disabled={addrSaving}>
                        {addrSaving ? "Saving…" : "Save Address"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery option */}
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" /> Delivery Option
                </h2>
                {DELIVERY_OPTIONS.map((opt) => (
                  <button key={opt.id} onClick={() => setDelivery(opt.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      delivery === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.days}</p>
                      </div>
                      <span className={`text-sm font-bold ${opt.price === 0 ? "text-green-600" : ""}`}>
                        {opt.price === 0 ? "Free" : formatCurrency(opt.price)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Payment method */}
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
                <h2 className="font-bold text-sm">Payment Method</h2>
                <div className="flex flex-col gap-2">
                  <label className={`p-3 rounded-xl border-2 cursor-pointer ${paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="pm" className="mr-2" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                    Pay by card (Stripe)
                  </label>
                  <label className={`p-3 rounded-xl border-2 cursor-pointer ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="pm" className="mr-2" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                    Cash on Delivery (Pay when the item is delivered)
                  </label>
                </div>
              </div>

              {initError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {initError}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!selectedAddr || payLoading}
                onClick={handleProceedToPayment}
              >
                {payLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                    </svg>
                    Preparing payment…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Proceed to Payment
                  </span>
                )}
              </Button>
              {!selectedAddr && (
                <p className="text-xs text-center text-muted-foreground -mt-2">Select a delivery address to continue</p>
              )}
            </>
          )}

          {step === "payment" && clientSecret && (
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Secure Payment
              </h2>
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                <PaymentForm
                  clientSecret={clientSecret}
                  paymentIntentId={paymentIntentId!}
                  shippingAddress={selectedAddr!}
                  breakdown={breakdown}
                  buyNowItems={[{ product: product._id, quantity }]}
                  onSuccess={handleSuccess}
                />
              </Elements>
            </div>
          )}
        </div>

        {/* Right: Order summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product */}
          <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-primary" /> Buying Now
            </p>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{product.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Qty: {quantity}</p>
                <p className="text-sm font-bold text-primary mt-1">{formatCurrency(product.price * quantity)}</p>
              </div>
            </div>
          </div>

          {/* Address summary */}
          {selectedAddr && (
            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Delivering to
              </p>
              <p className="text-sm font-semibold">{selectedAddr.label}</p>
              <p className="text-xs text-muted-foreground">{selectedAddr.street}</p>
              <p className="text-xs text-muted-foreground">{selectedAddr.city}, {selectedAddr.state} {selectedAddr.zipCode}</p>
              <p className="text-xs text-muted-foreground">{selectedAddr.country}</p>
            </div>
          )}

          {/* Price breakdown */}
          <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-xs font-semibold mb-3">Price Details</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Price ({quantity} item{quantity > 1 ? "s" : ""})</span>
                <span>{formatCurrency(itemsPrice)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span className={shippingCost === 0 ? "text-green-600" : ""}>
                  {shippingCost === 0 ? "Free" : formatCurrency(shippingCost)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax (8%)</span>
                <span>{formatCurrency(taxPrice)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-border pt-2 text-sm">
                <span>Total Amount</span>
                <span className="text-primary">{formatCurrency(totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
