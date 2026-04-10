import { Link, useNavigate } from "react-router";
import { Trash2, Plus, Minus, ShoppingBag, Tag, Truck, ChevronRight, BadgePercent, X, Zap, MapPin, CheckCircle2, Edit2, AlertCircle, LogIn, Home, Briefcase } from "lucide-react";
import { Button } from "../components/Button";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { authService, AddressData } from "../../services/authService";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { addressSchema, guestAddressSchema } from "../../lib/validationSchemas";

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

// Pincode deliverability simulation (purely client-side)
function checkPinDeliverability(pin: string): "deliverable" | "not-deliverable" | "invalid" {
  if (!/^\d{5,6}$/.test((pin ?? "").trim())) return "invalid";
  return "deliverable";
}

const EMPTY_FORM: AddressData = { label: "Home", phone: "", street: "", city: "", state: "", zipCode: "", country: "", isDefault: false };

const PROMO_CODES: Record<string, number> = {
  SAVE10: 10,
  WELCOME20: 20,
  DEAL15: 15,
};

// Seeded discount 14-80% based on product id
function seededDiscount(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return 14 + (Math.abs(h) % 67);
}

// Simulated MRP based on seeded discount
function getMRP(price: number, id: string) {
  return price / (1 - seededDiscount(id) / 100);
}

function getDiscountPct(id: string) {
  return seededDiscount(id);
}

function getDeliveryDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const DELIVERY_OPTIONS = [
  { id: "standard", label: "Standard Delivery", days: 5, price: 0, desc: "5-7 business days" },
  { id: "express", label: "Express Delivery", days: 2, price: 12.99, desc: "2-3 business days" },
  { id: "overnight", label: "Overnight", days: 1, price: 24.99, desc: "Next business day" },
];

export default function Cart() {
  const { items, removeFromCart, updateQuantity, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; pct: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [deliveryId, setDeliveryId] = useState("standard");

  // Address state
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  // Inline add-address panel
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAllAddrs, setShowAllAddrs] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressData>({ ...EMPTY_FORM });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});
  // Guest address form
  const [guestAddr, setGuestAddr] = useState({ name: "", phone: "", street: "", city: "", state: "", zipCode: "", country: "" });
  const [guestAddrErrors, setGuestAddrErrors] = useState<Record<string, string>>({});
  const [guestAddrValid, setGuestAddrValid] = useState(false);
  const [guestAddrOpen, setGuestAddrOpen] = useState(false);
  const [guestAddrSaved, setGuestAddrSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setAddrLoading(true);
      authService.getMe().then((res) => {
        const addrs: SavedAddress[] = res.data.user?.addresses ?? [];
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (def) setSelectedAddrId(def._id);
      }).catch(() => {}).finally(() => setAddrLoading(false));
    }
  }, [user]);

  useEffect(() => {
    const g = guestAddr;
    const result = guestAddressSchema.safeParse(g);
    setGuestAddrValid(result.success);
  }, [guestAddr]);

  // Derive pincode status from selected address automatically
  const selectedAddr = savedAddresses.find((a) => a._id === selectedAddrId);
  const pinStatus = selectedAddr ? checkPinDeliverability(selectedAddr.zipCode) : "idle";

  const canCheckout = pinStatus !== "not-deliverable" && (user ? !!selectedAddrId : guestAddrSaved);

  function validateAddrField(key: string, value: string) {
    const shape = addressSchema.shape as Record<string, import("zod").ZodTypeAny>;
    if (!shape[key]) return;
    const r = shape[key].safeParse(value);
    setAddrErrors((p) => ({ ...p, [key]: r.success ? "" : r.error.errors[0].message }));
  }

  function validateGuestField(key: string, value: string) {
    const shape = guestAddressSchema.shape as Record<string, import("zod").ZodTypeAny>;
    if (!shape[key]) return;
    const r = shape[key].safeParse(value);
    setGuestAddrErrors((p) => ({ ...p, [key]: r.success ? "" : r.error.errors[0].message }));
  }

  async function saveNewAddress() {
    const result = addressSchema.safeParse(addrForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
      setAddrErrors(errs);
      return;
    }
    setAddrErrors({});
    setAddrSaving(true);
    try {
      const res = await authService.addAddress(addrForm);
      const addrs: SavedAddress[] = res.data.addresses;
      setSavedAddresses(addrs);
      const newAddr = addrs[addrs.length - 1];
      if (newAddr) setSelectedAddrId(newAddr._id);
      setShowAddForm(false);
      setAddrForm({ ...EMPTY_FORM });
    } catch {
      // silently ignore
    } finally {
      setAddrSaving(false);
    }
  }

  const selectedDelivery = DELIVERY_OPTIONS.find((o) => o.id === deliveryId)!;
  const freeShipping = subtotal > 50;
  const shippingCost = (freeShipping && deliveryId === "standard") ? 0 : selectedDelivery.price;

  const couponDiscount = appliedPromo ? subtotal * (appliedPromo.pct / 100) : 0;
  const mrpTotal = items.reduce((s, i) => s + getMRP(i.price, i._id) * i.quantity, 0);
  const productDiscount = mrpTotal - subtotal;
  const tax = (subtotal - couponDiscount) * 0.08;
  const total = subtotal - couponDiscount + shippingCost + tax;

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setAppliedPromo({ code, pct: PROMO_CODES[code] });
      setPromoError("");
      setPromoInput("");
    } else {
      setPromoError("Invalid promo code");
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-8">Looks like you haven't added anything yet.</p>
          <Link to="/products">
            <Button variant="primary" size="lg">
              Start Shopping
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Shopping Cart</h1>
            <span className="ml-1 bg-primary text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {items.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map((item) => {
                const mrp = getMRP(item.price, item._id);
                const discPct = getDiscountPct(item._id);
                return (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
                  >
                    <div className="flex gap-0">
                      {/* Image */}
                      <div className="w-32 sm:w-40 flex-shrink-0 bg-muted relative">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover aspect-square"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.png"; }}
                        />
                        {/* Discount badge */}
                        <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          {discPct}% off
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/products/${item._id}`}>
                            <h3 className="font-semibold text-base leading-snug hover:text-primary transition-colors line-clamp-2">
                              {item.name}
                            </h3>
                          </Link>
                          <button
                            onClick={() => removeFromCart(item._id)}
                            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          {/* Qty stepper */}
                          <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item._id, -1)}
                              className="w-9 h-9 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item._id, 1)}
                              className="w-9 h-9 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Price + MRP */}
                          <div className="text-right">
                            <div className="text-lg font-bold text-foreground">
                              ${(item.price * item.quantity).toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground line-through">
                              MRP ${(mrp * item.quantity).toFixed(2)}
                            </div>
                            {item.quantity > 1 && (
                              <div className="text-xs text-muted-foreground">
                                ${item.price.toFixed(2)} each
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Savings banner */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <Zap className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-sm font-medium text-green-700">
                You're saving <span className="font-bold">${productDiscount.toFixed(2)}</span> on MRP with your cart items!
              </span>
            </div>

            {/* Free shipping progress */}
            {!freeShipping && (
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    Add <span className="text-primary font-bold">${(50 - subtotal).toFixed(2)}</span> more to unlock free Standard shipping
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((subtotal / 50) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {freeShipping && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">You've unlocked free Standard shipping! 🎉</span>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sticky top-4 space-y-3">
              <h2 className="text-base font-bold">Order Summary</h2>

              {/* ── DELIVERY ADDRESS ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" /> Deliver to
                  </p>
                  {user && !showAddForm && (
                    <button onClick={() => { setShowAddForm(true); setAddrForm({ ...EMPTY_FORM }); }}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Add New
                    </button>
                  )}
                </div>

                {user ? (
                  addrLoading ? (
                    <div className="space-y-2">
                      <div className="h-14 rounded-lg bg-slate-100 animate-pulse" />
                      <div className="h-14 rounded-lg bg-slate-100 animate-pulse" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* Saved address list */}
                      {(showAllAddrs ? savedAddresses : savedAddresses.filter((a) => a._id === selectedAddrId || (!selectedAddrId && savedAddresses.indexOf(a) === 0))).map((addr) => {
                        const ps = checkPinDeliverability(addr.zipCode);
                        return (
                          <label key={addr._id}
                            className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              selectedAddrId === addr._id ? "border-primary bg-primary/5" : "border-border hover:border-slate-300"
                            }`}
                          >
                            <input type="radio" name="address" value={addr._id}
                              checked={selectedAddrId === addr._id}
                              onChange={() => { setSelectedAddrId(addr._id); setShowAddForm(false); }}
                              className="mt-1 accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {addr.label.toLowerCase() === "work" ? (
                                  <Briefcase className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <Home className="w-3 h-3 text-muted-foreground" />
                                )}
                                <span className="text-xs font-bold uppercase tracking-wide">{addr.label}</span>
                                {addr.isDefault && <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-semibold">DEFAULT</span>}
                              </div>
                              <p className="text-xs text-foreground font-medium leading-snug">{addr.street}</p>
                              <p className="text-xs text-muted-foreground">{addr.city}, {addr.state} – {addr.zipCode}</p>
                              {addr.phone && <p className="text-xs text-muted-foreground">{addr.phone}</p>}
                              {selectedAddrId === addr._id && (
                                <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
                                  ps === "deliverable" ? "text-green-600" : ps === "not-deliverable" ? "text-destructive" : "text-muted-foreground"
                                }`}>
                                  {ps === "deliverable" && <><CheckCircle2 className="w-3 h-3" /> Delivery available</>}
                                  {ps === "not-deliverable" && <><AlertCircle className="w-3 h-3" /> Not serviceable to this pincode</>}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}

                      {/* View more / less */}
                      {savedAddresses.length > 1 && (
                        <button onClick={() => setShowAllAddrs((v) => !v)}
                          className="w-full text-xs text-primary font-semibold hover:underline py-1">
                          {showAllAddrs ? `View less` : `View ${savedAddresses.length - 1} more address${savedAddresses.length - 2 > 0 ? "es" : ""}`}
                        </button>
                      )}

                      {/* Inline Add New Address form */}
                      <AnimatePresence>
                        {showAddForm && (
                          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                            <p className="text-xs font-bold text-primary mb-1">Add New Address</p>

                            {/* Label pills */}
                            <div className="flex gap-1.5">
                              {["Home", "Work", "Other"].map((l) => (
                                <button key={l} type="button"
                                  onClick={() => setAddrForm((p) => ({ ...p, label: l }))}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                    addrForm.label === l ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                                  }`}
                                >{l}</button>
                              ))}
                            </div>

                            <input placeholder="Full Name *" value={(addrForm as any).name ?? ""}
                              onChange={(e) => { setAddrForm((p) => ({ ...p, name: e.target.value } as any)); setAddrErrors((p) => ({ ...p, name: "" })); }}
                              className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.name ? "border-destructive" : "border-border"}`} />
                            {addrErrors.name && <p className="text-destructive text-[10px]">{addrErrors.name}</p>}
                            <input placeholder="Phone Number *" type="tel" value={addrForm.phone ?? ""}
                              onChange={(e) => { setAddrForm((p) => ({ ...p, phone: e.target.value })); setAddrErrors((p) => ({ ...p, phone: "" })); }}
                              onBlur={(e) => validateAddrField("phone", e.target.value)}
                              className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.phone ? "border-destructive" : "border-border"}`} />
                            {addrErrors.phone ? <p className="text-destructive text-[10px]">{addrErrors.phone}</p> : <p className="text-muted-foreground text-[10px]">e.g. +91 98765 43210</p>}
                            <input placeholder="Street Address *" value={addrForm.street}
                              onChange={(e) => { setAddrForm((p) => ({ ...p, street: e.target.value })); setAddrErrors((p) => ({ ...p, street: "" })); }}
                              onBlur={(e) => validateAddrField("street", e.target.value)}
                              className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.street ? "border-destructive" : "border-border"}`} />
                            {addrErrors.street && <p className="text-destructive text-[10px]">{addrErrors.street}</p>}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <input placeholder="City *" value={addrForm.city}
                                  onChange={(e) => { setAddrForm((p) => ({ ...p, city: e.target.value })); setAddrErrors((p) => ({ ...p, city: "" })); }}
                                  onBlur={(e) => validateAddrField("city", e.target.value)}
                                  className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.city ? "border-destructive" : "border-border"}`} />
                                {addrErrors.city && <p className="text-destructive text-[10px]">{addrErrors.city}</p>}
                              </div>
                              <div>
                                <input placeholder="State *" value={addrForm.state}
                                  onChange={(e) => { setAddrForm((p) => ({ ...p, state: e.target.value })); setAddrErrors((p) => ({ ...p, state: "" })); }}
                                  onBlur={(e) => validateAddrField("state", e.target.value)}
                                  className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.state ? "border-destructive" : "border-border"}`} />
                                {addrErrors.state && <p className="text-destructive text-[10px]">{addrErrors.state}</p>}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <input placeholder="ZIP / Pincode *" value={addrForm.zipCode} maxLength={6}
                                  onChange={(e) => { setAddrForm((p) => ({ ...p, zipCode: e.target.value })); setAddrErrors((p) => ({ ...p, zipCode: "" })); }}
                                  onBlur={(e) => validateAddrField("zipCode", e.target.value)}
                                  className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.zipCode ? "border-destructive" : "border-border"}`} />
                                {addrErrors.zipCode ? <p className="text-destructive text-[10px]">{addrErrors.zipCode}</p> : <p className="text-muted-foreground text-[10px]">e.g. 110001 or SW1A</p>}
                              </div>
                              <div>
                                <input placeholder="Country *" value={addrForm.country}
                                  onChange={(e) => { setAddrForm((p) => ({ ...p, country: e.target.value })); setAddrErrors((p) => ({ ...p, country: "" })); }}
                                  onBlur={(e) => validateAddrField("country", e.target.value)}
                                  className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${addrErrors.country ? "border-destructive" : "border-border"}`} />
                                {addrErrors.country && <p className="text-destructive text-[10px]">{addrErrors.country}</p>}
                              </div>
                            </div>
                            {addrForm.zipCode.length >= 5 && (
                              <div className={`text-xs flex items-center gap-1 font-medium ${
                                checkPinDeliverability(addrForm.zipCode) === "deliverable" ? "text-green-600" :
                                checkPinDeliverability(addrForm.zipCode) === "not-deliverable" ? "text-destructive" : "text-muted-foreground"
                              }`}>
                                {checkPinDeliverability(addrForm.zipCode) === "deliverable" && <><CheckCircle2 className="w-3 h-3" /> Delivery available</>}
                                {checkPinDeliverability(addrForm.zipCode) === "not-deliverable" && <><AlertCircle className="w-3 h-3" /> Pincode not serviceable</>}
                              </div>
                            )}
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input type="checkbox" checked={!!addrForm.isDefault}
                                onChange={(e) => setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))}
                                className="rounded accent-primary" />
                              Set as default address
                            </label>
                            <div className="flex gap-2 pt-0.5">
                              <button onClick={saveNewAddress} disabled={addrSaving || checkPinDeliverability(addrForm.zipCode) === "not-deliverable"}
                                className="flex-1 py-1.5 text-xs bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {addrSaving ? "Saving…" : "Save & Use"}
                              </button>
                              <button onClick={() => { setShowAddForm(false); setAddrForm({ ...EMPTY_FORM }); }}
                                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-slate-50 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {savedAddresses.length === 0 && !showAddForm && (
                        <button onClick={() => setShowAddForm(true)}
                          className="w-full flex items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors">
                          <Plus className="w-4 h-4" /> Add a delivery address
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  // Guest address — collapsible accordion
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      <LogIn className="w-3.5 h-3.5 flex-shrink-0" />
                      <span><Link to="/login" className="font-semibold underline">Sign in</Link> to use saved addresses</span>
                    </div>

                    {/* Saved summary card */}
                    {guestAddrSaved ? (
                      <div className="flex items-start gap-2 p-2.5 rounded-xl border border-primary bg-primary/5">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">{guestAddr.name}</p>
                          <p className="text-xs text-muted-foreground">{guestAddr.street}</p>
                          <p className="text-xs text-muted-foreground">{guestAddr.city}, {guestAddr.state} – {guestAddr.zipCode}</p>
                          <p className="text-xs text-muted-foreground">{guestAddr.country} · {guestAddr.phone}</p>
                        </div>
                        <button onClick={() => { setGuestAddrSaved(false); setGuestAddrOpen(true); }}
                          className="flex-shrink-0 text-primary hover:text-primary/80 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Collapsed trigger */}
                        {!guestAddrOpen && (
                          <button
                            onClick={() => setGuestAddrOpen(true)}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-primary/40 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors">
                            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Enter delivery address</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}

                        {/* Expanded form */}
                        <AnimatePresence>
                          {guestAddrOpen && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                              className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-bold text-primary">Delivery Address</p>
                                <button onClick={() => setGuestAddrOpen(false)} className="text-muted-foreground hover:text-foreground">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {([
                                { key: "name", placeholder: "Full name *", type: "text", hint: "" },
                                { key: "phone", placeholder: "Phone number *", type: "tel", hint: "e.g. +91 98765 43210" },
                                { key: "street", placeholder: "Street address *", type: "text", hint: "" },
                                { key: "city", placeholder: "City *", type: "text", hint: "" },
                                { key: "state", placeholder: "State *", type: "text", hint: "" },
                                { key: "zipCode", placeholder: "ZIP / Pincode *", type: "text", hint: "e.g. 110001 or SW1A" },
                                { key: "country", placeholder: "Country *", type: "text", hint: "" },
                              ] as const).map(({ key, placeholder, type, hint }) => (
                                <div key={key}>
                                  <input type={type} placeholder={placeholder} value={(guestAddr as any)[key]}
                                    onChange={(e) => { setGuestAddr((p) => ({ ...p, [key]: e.target.value })); setGuestAddrErrors((p) => ({ ...p, [key]: "" })); }}
                                    onBlur={(e) => validateGuestField(key, e.target.value)}
                                    className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white ${guestAddrErrors[key] ? "border-destructive" : "border-border"}`} />
                                  {guestAddrErrors[key] ? <p className="text-destructive text-[10px] mt-0.5">{guestAddrErrors[key]}</p> : hint ? <p className="text-muted-foreground text-[10px] mt-0.5">{hint}</p> : null}
                                </div>
                              ))}
                              {guestAddr.zipCode.length >= 5 && (
                                <div className={`text-xs flex items-center gap-1 font-medium ${
                                  checkPinDeliverability(guestAddr.zipCode) === "deliverable" ? "text-green-600" :
                                  checkPinDeliverability(guestAddr.zipCode) === "not-deliverable" ? "text-destructive" : ""
                                }`}>
                                  {checkPinDeliverability(guestAddr.zipCode) === "deliverable" && <><CheckCircle2 className="w-3 h-3" /> Delivery available</>}
                                  {checkPinDeliverability(guestAddr.zipCode) === "not-deliverable" && <><AlertCircle className="w-3 h-3" /> Pincode not serviceable</>}
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  const result = guestAddressSchema.safeParse(guestAddr);
                                  if (!result.success) {
                                    const errs: Record<string, string> = {};
                                    result.error.errors.forEach((e) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
                                    setGuestAddrErrors(errs);
                                    return;
                                  }
                                  setGuestAddrErrors({});
                                  setGuestAddrSaved(true);
                                  setGuestAddrOpen(false);
                                }}
                                className="w-full py-1.5 text-xs bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                Use this address
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery options */}
              <div>
                <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-primary" /> Delivery Option
                </p>
                <div className="space-y-1.5">
                  {DELIVERY_OPTIONS.map((opt) => {
                    const isFree = freeShipping && opt.id === "standard";
                    const cost = isFree ? 0 : opt.price;
                    const estDate = getDeliveryDate(opt.days);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          deliveryId === opt.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="delivery"
                          value={opt.id}
                          checked={deliveryId === opt.id}
                          onChange={() => setDeliveryId(opt.id)}
                          className="mt-0.5 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{opt.label}</span>
                              <span className={`text-xs font-bold ${cost === 0 ? "text-green-600" : ""}`}>
                                {cost === 0 ? "Free" : `$${cost.toFixed(2)}`}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">{estDate}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Price breakdown */}
              <div className="space-y-1.5 text-sm border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MRP Total</span>
                  <span className="line-through text-muted-foreground">${mrpTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Product Discount</span>
                  <span className="font-medium">−${productDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <BadgePercent className="w-3.5 h-3.5" /> Coupon ({appliedPromo.pct}%)
                    </span>
                    <span className="font-medium">−${couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className={`font-medium ${shippingCost === 0 ? "text-green-600" : ""}`}>
                    {shippingCost === 0 ? "Free" : `$${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="font-bold text-sm">Total</span>
                  <span className="font-extrabold text-xl text-primary">${total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-green-600 font-medium text-right">
                  Total savings: ${(productDiscount + couponDiscount).toFixed(2)}
                </p>
              </div>

              {/* Promo code */}
              <div>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <BadgePercent className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-700">{appliedPromo.code}</span>
                      <span className="text-green-600">−{appliedPromo.pct}% off</span>
                    </div>
                    <button onClick={() => setAppliedPromo(null)} className="text-green-600 hover:text-green-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value); setPromoError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                        placeholder="Promo code"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <Button variant="outline" className="text-sm px-4" onClick={applyPromo}>Apply</Button>
                  </div>
                )}
                {promoError && <p className="text-xs text-destructive mt-1 ml-1">{promoError}</p>}
              </div>

              <Button variant="primary" className="w-full" size="lg"
                disabled={!canCheckout}
                onClick={() => {
                  if (!canCheckout) return;
                  navigate("/checkout", {
                    state: {
                      selectedAddr: selectedAddr ?? (guestAddrSaved ? guestAddr : null),
                      shippingCost,
                      couponDiscount,
                      total,
                      breakdown: {
                        itemsPrice: subtotal,
                        shippingPrice: shippingCost,
                        taxPrice: tax,
                        couponDiscount,
                        totalPrice: total,
                      },
                    },
                  });
                }}
                title={!canCheckout ? (user ? "Please select a delivery address" : "Please enter a delivery address") : ""}
              >
                Checkout
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              {!canCheckout && (
                <p className="text-xs text-center text-muted-foreground -mt-1">
                  {user ? "Select a delivery address above" : "Enter your delivery address to continue"}
                </p>
              )}

              <Link to="/products">
                <Button variant="outline" className="w-full text-sm">
                  Continue Shopping
                </Button>
              </Link>

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span>🔒 Secure checkout</span>
                <span>·</span>
                <span>30-day returns</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
