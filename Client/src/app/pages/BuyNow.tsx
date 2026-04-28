import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router";
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

// ─── Delivery options ─────────────────────────────────────────────────────────
const DELIVERY_OPTIONS = [
  { id: "standard", label: "Standard Delivery", days: "5–7 business days", price: 0 },
  { id: "express", label: "Express Delivery", days: "2–3 business days", price: 12.99 },
  { id: "overnight", label: "Overnight", days: "Next business day", price: 24.99 },
];

// ─── Saved address card ────────────────────────────────────────────────────────
interface SavedAddress {
  _id: string;
  name?: string;
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

  const [delivery, setDelivery] = useState("standard");

  // Address state
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressData>({
    name: "", label: "Home", phone: "", street: "", city: "", state: "", zipCode: "", country: "", isDefault: false,
  });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});
  const [addrSubmitError, setAddrSubmitError] = useState("");

  // Payment state
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
  }, [location, navigate, product, user]);

  if (!product) return null;

  const selectedAddr = savedAddresses.find((a) => a._id === selectedAddrId);
  const deliveryOption = DELIVERY_OPTIONS.find((d) => d.id === delivery)!;
  const shippingCost = deliveryOption.price;
  const itemsPrice = product.price * quantity;
  const taxPrice = 0;
  const totalPrice = parseFloat((itemsPrice + shippingCost).toFixed(2));

  const handleProceedToPayment = async () => {
    if (!selectedAddr) return;
    setPayLoading(true);
    setInitError("");
    try {
      const res = await api.post("/orders", {
        items: [{ product: product._id, quantity }],
        shippingAddress: selectedAddr,
        paymentMethod: "cod",
        shippingPrice: shippingCost,
      });
      setOrderId(res.data.order._id);
      setSuccess(true);
    } catch (e) {
      setInitError("Failed to place COD order. Please try again.");
    } finally {
      setPayLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    setAddrSubmitError("");
    const result = addressSchema.safeParse(addrForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path.length > 0) errs[String(issue.path[0])] = issue.message;
      });
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
      setAddrSubmitError("");
      setAddrForm({ name: "", label: "Home", phone: "", street: "", city: "", state: "", zipCode: "", country: "", isDefault: false });
    } catch (error: any) {
      setAddrSubmitError(error?.response?.data?.message ?? "Failed to save address. Please check the highlighted fields and try again.");
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

  const inputCls = (field: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${
      addrErrors[field] ? "border-destructive focus:ring-destructive/20" : "border-border"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Zap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Buy Now</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Address / Payment */}
        <div className="lg:col-span-3 space-y-4">

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
                        {addr.name && <p className="text-xs font-medium text-foreground">{addr.name}</p>}
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
                    {addrSubmitError && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{addrSubmitError}</span>
                      </div>
                    )}
                    <div>
                      <input className={inputCls("name")} placeholder="Full Name *" value={addrForm.name ?? ""} onChange={(e) => { setAddrForm((f) => ({ ...f, name: e.target.value })); setAddrErrors((p) => ({ ...p, name: "" })); }} />
                      {addrErrors.name && <p className="text-destructive text-[10px]">{addrErrors.name}</p>}
                    </div>
                    <div>
                      <input className={inputCls("phone")} placeholder="Phone Number *" value={addrForm.phone ?? ""} onChange={(e) => { setAddrForm((f) => ({ ...f, phone: e.target.value })); setAddrErrors((p) => ({ ...p, phone: "" })); }} />
                      {addrErrors.phone ? <p className="text-destructive text-[10px]">{addrErrors.phone}</p> : <p className="text-muted-foreground text-[10px]">e.g. 9876543210</p>}
                    </div>
                    <div>
                      <input className={inputCls("street")} placeholder="Street address *" value={addrForm.street} onChange={(e) => { setAddrForm((f) => ({ ...f, street: e.target.value })); setAddrErrors((p) => ({ ...p, street: "" })); }} />
                      {addrErrors.street && <p className="text-destructive text-[10px]">{addrErrors.street}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input className={inputCls("city")} placeholder="City *" value={addrForm.city} onChange={(e) => { setAddrForm((f) => ({ ...f, city: e.target.value })); setAddrErrors((p) => ({ ...p, city: "" })); }} />
                        {addrErrors.city && <p className="text-destructive text-[10px]">{addrErrors.city}</p>}
                      </div>
                      <div>
                        <input className={inputCls("state")} placeholder="State *" value={addrForm.state} onChange={(e) => { setAddrForm((f) => ({ ...f, state: e.target.value })); setAddrErrors((p) => ({ ...p, state: "" })); }} />
                        {addrErrors.state && <p className="text-destructive text-[10px]">{addrErrors.state}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input className={inputCls("zipCode")} placeholder="ZIP / Pincode *" value={addrForm.zipCode} onChange={(e) => { setAddrForm((f) => ({ ...f, zipCode: e.target.value })); setAddrErrors((p) => ({ ...p, zipCode: "" })); }} />
                        {addrErrors.zipCode && <p className="text-destructive text-[10px]">{addrErrors.zipCode}</p>}
                      </div>
                      <div>
                        <input className={inputCls("country")} placeholder="Country *" value={addrForm.country} onChange={(e) => { setAddrForm((f) => ({ ...f, country: e.target.value })); setAddrErrors((p) => ({ ...p, country: "" })); }} />
                        {addrErrors.country && <p className="text-destructive text-[10px]">{addrErrors.country}</p>}
                      </div>
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

              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-2">
                <h2 className="font-bold text-sm">Payment Method</h2>
                <div className="p-3 rounded-xl border-2 border-primary bg-primary/5 text-sm">
                  Cash on Delivery (COD) only
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
                    <Lock className="w-4 h-4" /> Place COD Order
                  </span>
                )}
              </Button>
              {!selectedAddr && (
                <p className="text-xs text-center text-muted-foreground -mt-2">Select a delivery address to continue</p>
              )}
          </>
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
              {selectedAddr.name && <p className="text-sm font-semibold">{selectedAddr.name}</p>}
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
