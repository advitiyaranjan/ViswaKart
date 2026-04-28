import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { ShoppingBag, MapPin, Truck, Lock, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { orderService } from "../../services/orderService";
import { Button } from "../components/Button";
import { formatCurrency } from "../../lib/currency";

// ─── Main Checkout page ───────────────────────────────────────────────────────

export default function Checkout() {
  const { items, removeItems } = useCart() as any;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const checkoutState = location.state as {
    selectedAddr: any;
    shippingCost: number;
    couponDiscount: number;
    total: number;
    selectedItemIds?: string[];
    breakdown: any;
  } | null;

  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [placingCod, setPlacingCod] = useState(false);

  // Determine which items are being checked out
  const checkoutItemIds = checkoutState?.selectedItemIds;
  const checkoutItems: any[] = checkoutItemIds
    ? items.filter((i: any) => checkoutItemIds.includes(i._id))
    : items;

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!items || items.length === 0) { navigate("/cart"); return; }
    if (!checkoutState?.selectedAddr) { navigate("/cart"); return; }
  }, [checkoutState?.selectedAddr, items, navigate, user]);

  const handlePlaceCod = async () => {
    if (!checkoutItems || checkoutItems.length === 0) return;
    setPlacingCod(true);
    try {
      const res = await orderService.createOrder({
        items: checkoutItems.map((i: any) => ({ product: i._id, quantity: i.quantity })),
        shippingAddress: checkoutState.selectedAddr,
        paymentMethod: "cod",
        shippingPrice: checkoutState.shippingCost,
      });
      // remove items and mark success
      removeItems?.(checkoutItems.map((i: any) => i._id));
      setOrderId(res.data.order._id);
      setSuccess(true);
    } catch (err) {
      alert("Failed to place COD order. Please try again.");
    } finally {
      setPlacingCod(false);
    }
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
            <Link to="/">
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
              <Lock className="w-4 h-4 text-primary" /> Cash On Delivery
            </h2>
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                Cash on Delivery is currently the only available payment option.
              </div>
              <Button
                className="w-full"
                onClick={handlePlaceCod}
                disabled={placingCod}
              >
                {placingCod ? "Placing order…" : "Place COD Order"}
              </Button>
            </div>
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
                <ShoppingBag className="w-4 h-4 text-primary" /> Order Items ({checkoutItems.length})
              </p>
              <div className="space-y-2">
                {checkoutItems.map((item: any) => (
                <div key={item._id} className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            {checkoutState?.breakdown && (
              <div className="border-t border-border mt-3 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{formatCurrency(checkoutState.breakdown.itemsPrice)}</span>
                </div>
                {checkoutState.breakdown.couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                      <span>Discount</span><span>−{formatCurrency(checkoutState.breakdown.couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                    <span className={checkoutState.breakdown.shippingPrice === 0 ? "text-green-600" : ""}>
                      {checkoutState.breakdown.shippingPrice === 0 ? "Free" : formatCurrency(checkoutState.breakdown.shippingPrice)}
                    </span>
                </div>
                <div className="flex justify-between font-bold border-t border-border pt-1.5 text-sm">
                  <span>Total</span>
                    <span className="text-primary">{formatCurrency(checkoutState.breakdown.totalPrice)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Delivery */}
          {checkoutState && (
            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary" />
               {checkoutState.shippingCost === 0 ? "Free Standard Delivery" : `Delivery: ${formatCurrency(checkoutState.shippingCost)}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
