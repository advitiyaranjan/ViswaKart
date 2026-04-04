import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { ShoppingBag, MapPin, Truck, Lock, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { Button } from "../components/Button";

const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Inner form (has access to stripe/elements hooks) ────────────────────────

interface PayFormProps {
  clientSecret: string;
  paymentIntentId: string;
  shippingAddress: object;
  breakdown: object;
  cartItems: { product: string; quantity: number }[];
  onSuccess: (orderId: string) => void;
}

function PaymentForm({
  clientSecret,
  paymentIntentId,
  shippingAddress,
  breakdown,
  cartItems,
  onSuccess,
}: PayFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError("");

    // Confirm payment with Stripe
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try again.");
      setPaying(false);
      return;
    }

    // Payment succeeded — create the order in our DB
    try {
      const res = await api.post("/payments/confirm-order", {
        paymentIntentId,
        items: cartItems,
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
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span>⚠</span> {error}
        </div>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        size="lg"
        disabled={!stripe || paying}
      >
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

// ─── Main Checkout page ───────────────────────────────────────────────────────

export default function Checkout() {
  const { items, clearCart } = useCart() as any;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const checkoutState = location.state as {
    selectedAddr: any;
    shippingCost: number;
    couponDiscount: number;
    total: number;
    breakdown: any;
  } | null;

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!items || items.length === 0) { navigate("/cart"); return; }
    if (!checkoutState?.selectedAddr) { navigate("/cart"); return; }

    api.post("/payments/create-intent", {
      items: items.map((i: any) => ({ product: i._id, quantity: i.quantity })),
      shippingPrice: checkoutState.shippingCost,
      couponDiscount: checkoutState.couponDiscount,
    })
      .then((res) => {
        setClientSecret(res.data.clientSecret);
        setPaymentIntentId(res.data.paymentIntentId);
        setBreakdown(res.data.breakdown);
      })
      .catch(() => setInitError("Failed to initialise payment. Please go back and try again."))
      .finally(() => setLoading(false));
  }, []);

  const handleSuccess = (id: string) => {
    clearCart?.();
    setOrderId(id);
    setSuccess(true);
  };

  // ── Success screen ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-border shadow-xl p-10 max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Order Placed!</h1>
          <p className="text-muted-foreground text-sm">
            Your payment was successful and your order is confirmed. We'll send you updates as it ships.
          </p>
          {orderId && (
            <p className="text-xs font-mono bg-slate-100 rounded-lg px-3 py-2 text-foreground">
              Order ID: #{orderId.slice(-10).toUpperCase()}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/products">
              <Button variant="primary" className="w-full">Continue Shopping</Button>
            </Link>
            <Link to="/account">
              <Button variant="outline" className="w-full">View My Orders</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const addr = checkoutState?.selectedAddr;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Checkout</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Payment section */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
            <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> Secure Payment
            </h2>

            {loading ? (
              <div className="space-y-3">
                <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-40 rounded-lg bg-slate-100 animate-pulse" />
              </div>
            ) : initError ? (
              <div className="text-sm text-destructive">{initError}</div>
            ) : clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: { theme: "stripe" } }}
              >
                <PaymentForm
                  clientSecret={clientSecret}
                  paymentIntentId={paymentIntentId!}
                  shippingAddress={addr}
                  breakdown={breakdown}
                  cartItems={items.map((i: any) => ({ product: i._id, quantity: i.quantity }))}
                  onSuccess={handleSuccess}
                />
              </Elements>
            ) : null}
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Delivery address */}
          {addr && (
            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Delivering to
              </p>
              <p className="text-sm font-semibold">{addr.label}</p>
              <p className="text-sm text-muted-foreground">{addr.street}</p>
              <p className="text-sm text-muted-foreground">
                {addr.city}, {addr.state} {addr.zipCode}
              </p>
              <p className="text-sm text-muted-foreground">{addr.country}</p>
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-primary" /> Order Items ({items.length})
            </p>
            <div className="space-y-2">
              {items.map((item: any) => (
                <div key={item._id} className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            {breakdown && (
              <div className="border-t border-border mt-3 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>${breakdown.itemsPrice.toFixed(2)}</span>
                </div>
                {breakdown.couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span><span>−${breakdown.couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className={breakdown.shippingPrice === 0 ? "text-green-600" : ""}>
                    {breakdown.shippingPrice === 0 ? "Free" : `$${breakdown.shippingPrice.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (8%)</span><span>${breakdown.taxPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-border pt-1.5 text-sm">
                  <span>Total</span>
                  <span className="text-primary">${breakdown.totalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Delivery */}
          {checkoutState && (
            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary" />
                {checkoutState.shippingCost === 0 ? "Free Standard Delivery" : `Delivery: $${checkoutState.shippingCost.toFixed(2)}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
