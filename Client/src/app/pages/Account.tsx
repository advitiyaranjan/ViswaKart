import React from "react";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { User, MapPin, ShoppingBag, HelpCircle, Edit2, Trash2, Plus, Eye, EyeOff, Check, X, ChevronDown, ChevronUp, Package, Truck, CheckCircle2, Clock, XCircle, Star } from "lucide-react";
import { authService, AddressData } from "../../services/authService";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../components/Button";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Address {
  _id: string;
  label: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

interface OrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  items: OrderItem[];
  shippingAddress: { street: string; city: string; state: string; zipCode: string; country: string };
  paymentMethod: string;
  totalPrice: number;
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  status: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ReactElement; color: string; bg: string }> = {
  Pending:    { icon: <Clock className="w-4 h-4" />,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  Processing: { icon: <Package className="w-4 h-4" />,       color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  Shipped:    { icon: <Truck className="w-4 h-4" />,          color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  Delivered:  { icon: <CheckCircle2 className="w-4 h-4" />,  color: "text-green-600",  bg: "bg-green-50 border-green-200" },
  Cancelled:  { icon: <XCircle className="w-4 h-4" />,       color: "text-red-600",    bg: "bg-red-50 border-red-200" },
};

const TABS: { id: string; label: string; icon: React.ReactElement }[] = [
  { id: "profile",   label: "Account Details", icon: <User className="w-4 h-4" /> },
  { id: "addresses", label: "Saved Addresses",  icon: <MapPin className="w-4 h-4" /> },
  { id: "orders",    label: "Previous Orders",  icon: <ShoppingBag className="w-4 h-4" /> },
  { id: "help",      label: "Help & Support",   icon: <HelpCircle className="w-4 h-4" /> },
];

const FAQS = [
  { q: "How do I track my order?", a: "Once your order is shipped, you'll receive a tracking number. You can view it in the Previous Orders tab." },
  { q: "Can I change or cancel my order?", a: "Orders can be cancelled within 1 hour of placement if they haven't started processing. Contact our support team for help." },
  { q: "What is the return policy?", a: "We offer a 30-day hassle-free return policy. Items must be in original condition with tags attached." },
  { q: "How long does delivery take?", a: "Standard delivery: 5–7 business days. Express: 2–3 days. Overnight: next business day." },
  { q: "Are my payment details safe?", a: "Yes, all transactions are secured with SSL encryption. We never store raw card details." },
  { q: "How do I update my email address?", a: "Email changes require re-verification. Please contact our support team to update your email." },
];

// ─── Address Form ─────────────────────────────────────────────────────────────

interface AddressFormProps {
  initial?: Partial<Address>;
  onSave: (data: AddressData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function AddressForm({ initial = {}, onSave, onCancel, saving }: AddressFormProps) {
  const [form, setForm] = useState<AddressData>({
    label: initial.label ?? "Home",
    phone: (initial as any).phone ?? "",
    street: initial.street ?? "",
    city: initial.city ?? "",
    state: initial.state ?? "",
    zipCode: initial.zipCode ?? "",
    country: initial.country ?? "",
    isDefault: initial.isDefault ?? false,
  });

  const f = (field: keyof AddressData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const addrValid = !!(form.phone ?? "").trim() && !!form.zipCode.trim() && !!form.street.trim() && !!form.city.trim() && !!form.state.trim() && !!form.country.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrValid) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Label</label>
          <input value={form.label} onChange={f("label")} placeholder="Home / Work / Other"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mobile Number <span className="text-destructive">*</span></label>
          <input value={(form as any).phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" type="tel" required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Country</label>
          <input value={form.country} onChange={f("country")} placeholder="United States" required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Street Address</label>
        <input value={form.street} onChange={f("street")} placeholder="123 Main St, Apt 4B" required
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
          <input value={form.city} onChange={f("city")} placeholder="New York" required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">State</label>
          <input value={form.state} onChange={f("state")} placeholder="NY" required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ZIP / Pincode <span className="text-destructive">*</span></label>
          <input value={form.zipCode} onChange={f("zipCode")} placeholder="10001" required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={!!form.isDefault}
          onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
          className="rounded accent-primary" />
        <span>Set as default address</span>
      </label>
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={saving || !addrValid}>
          {saving ? "Saving…" : "Save Address"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Account() {
  const { user: authUser, updateUser } = useAuth() as any;
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get("tab");
    return ["profile", "addresses", "orders", "help"].includes(t ?? "") ? t! : "profile";
  });

  // Profile form
  const [profileName, setProfileName] = useState(authUser?.name ?? "");
  const [profilePhone, setProfilePhone] = useState(authUser?.phone ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Contact OTP update
  const [otpModal, setOtpModal] = useState<{ type: "email" | "phone"; newValue: string } | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(authUser?.email ?? "");
  const [pendingPhone, setPendingPhone] = useState(authUser?.phone ?? "");

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");

  // Addresses
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [addrSaving, setAddrSaving] = useState(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Load addresses + orders on mount
  useEffect(() => {
    authService.getMe().then((res) => {
      setAddresses(res.data.user?.addresses ?? []);
      setAddrLoading(false);
    }).catch(() => setAddrLoading(false));

    orderService.getMyOrders({ limit: 50 }).then((res) => {
      setOrders(res.data.orders ?? []);
      setOrdersLoading(false);
    }).catch(() => setOrdersLoading(false));
  }, []);

  // ── Profile save ──────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!profileName.trim()) { setProfileError("Name is required."); return; }
    if (!authUser?.email?.trim() && !profilePhone.trim()) { setProfileError("At least one of email or mobile number is required."); return; }
    setProfileSaving(true);
    setProfileError("");
    try {
      const res = await authService.updateProfile({ name: profileName.trim(), phone: profilePhone.trim() });
      const updated = res.data.user;
      if (updateUser) updateUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError("Failed to update profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Contact OTP (email / phone) ───────────────────────────────────────────
  const openOtpModal = async (type: "email" | "phone") => {
    const newValue = type === "email" ? pendingEmail.trim() : pendingPhone.trim();
    if (!newValue) return;
    if (type === "email" && newValue === authUser?.email) return;
    if (type === "phone" && newValue === authUser?.phone) return;
    setOtpError("");
    setOtpInput("");
    setOtpSent(false);
    setOtpModal({ type, newValue });
    // auto-send OTP
    setOtpSending(true);
    try {
      await authService.sendContactOtp({ type, newValue });
      setOtpSent(true);
    } catch (err: any) {
      setOtpError(err?.response?.data?.message ?? "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const resendOtp = async () => {
    if (!otpModal) return;
    setOtpError("");
    setOtpSending(true);
    try {
      await authService.sendContactOtp(otpModal);
      setOtpSent(true);
    } catch (err: any) {
      setOtpError(err?.response?.data?.message ?? "Failed to send OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyContactOtp = async () => {
    if (!otpModal || !otpInput.trim()) return;
    setOtpVerifying(true);
    setOtpError("");
    try {
      const res = await authService.verifyContactOtp({ ...otpModal, otp: otpInput.trim() });
      const updated = res.data.user;
      if (updateUser) updateUser(updated);
      if (otpModal.type === "email") setPendingEmail(updated.email ?? otpModal.newValue);
      if (otpModal.type === "phone") setPendingPhone(updated.phone ?? otpModal.newValue);
      setOtpModal(null);
      setOtpInput("");
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setOtpError(err?.response?.data?.message ?? "Invalid OTP.");
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Password save ─────────────────────────────────────────────────────────
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    setPwSaving(true);
    setPwError("");
    try {
      await authService.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err?.response?.data?.message ?? "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  };

  // ── Address CRUD ──────────────────────────────────────────────────────────
  const handleAddAddress = async (data: AddressData) => {
    setAddrSaving(true);
    try {
      const res = await authService.addAddress(data);
      setAddresses(res.data.addresses);
      setShowAddForm(false);
    } catch {
      // silently ignore
    } finally {
      setAddrSaving(false);
    }
  };

  const handleUpdateAddress = async (data: AddressData) => {
    if (!editingAddr) return;
    setAddrSaving(true);
    try {
      const res = await authService.updateAddress(editingAddr._id, data);
      setAddresses(res.data.addresses);
      setEditingAddr(null);
    } catch {
      // silently ignore
    } finally {
      setAddrSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    try {
      const res = await authService.deleteAddress(id);
      setAddresses(res.data.addresses);
    } catch {
      // silently ignore
    }
  };

  // ── Avatars ───────────────────────────────────────────────────────────────
  const initials = (authUser?.name ?? "U").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Account</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your profile, addresses, and orders</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            {/* Avatar card */}
            <div className="bg-white rounded-2xl border border-border p-4 flex flex-col items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center text-white text-xl font-bold select-none">
                {initials}
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">{authUser?.name}</p>
                <p className="text-xs text-muted-foreground">{authUser?.email}</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="bg-white rounded-2xl border border-border overflow-hidden">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all border-b border-border last:border-0 ${
                    activeTab === tab.id
                      ? "bg-primary/5 text-primary font-semibold"
                      : "text-foreground hover:bg-slate-50"
                  }`}
                >
                  <span className={activeTab === tab.id ? "text-primary" : "text-muted-foreground"}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-4">

            {/* ── PROFILE TAB ────────────────────────────────────────────── */}
            {activeTab === "profile" && (
              <>
                {/* Basic info */}
                <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                  <h2 className="font-bold text-base mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Account Details
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name</label>
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Email — editable with OTP */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Email Address</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={pendingEmail}
                          onChange={(e) => setPendingEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                          type="button"
                          onClick={() => openOtpModal("email")}
                          disabled={!pendingEmail.trim() || pendingEmail.trim() === authUser?.email}
                          className="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          Verify & Update
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">An OTP will be sent to the new email for verification.</p>
                    </div>

                    {/* Phone — editable with OTP */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Mobile Number {!authUser?.email && <span className="text-destructive">*</span>}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={pendingPhone}
                          onChange={(e) => setPendingPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                          type="button"
                          onClick={() => openOtpModal("phone")}
                          disabled={!pendingPhone.trim() || pendingPhone.trim() === authUser?.phone}
                          className="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          Verify & Update
                        </button>
                      </div>
                      {!authUser?.email && !pendingPhone.trim() && (
                        <p className="text-xs text-destructive mt-1">Mobile number required when no email is set.</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">OTP will be sent to your registered email to verify this new number.</p>
                    </div>

                    {profileError && <p className="text-sm text-destructive">{profileError}</p>}
                    {profileSuccess && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <Check className="w-4 h-4" /> Updated successfully!
                      </div>
                    )}

                    <Button variant="primary" size="sm" onClick={saveProfile} disabled={profileSaving || !profileName.trim()}>
                      {profileSaving ? "Saving…" : "Save Name"}
                    </Button>
                  </div>

                  {/* OTP verification modal */}
                  {otpModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-base">Verify {otpModal.type === "email" ? "Email" : "Mobile Number"}</h3>
                          <button onClick={() => setOtpModal(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        {otpSending ? (
                          <p className="text-sm text-muted-foreground">Sending OTP…</p>
                        ) : otpSent ? (
                          <>
                            {otpModal.type === "email" ? (
                              <p className="text-sm text-muted-foreground">
                                A 6-digit OTP has been sent to your new email{" "}
                                <span className="font-semibold text-foreground">{otpModal.newValue}</span>.{" "}
                                Enter it below to confirm ownership.
                              </p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">
                                  A 6-digit OTP has been sent to your registered email{" "}
                                  <span className="font-semibold text-foreground">{authUser?.email}</span>{" "}
                                  to verify your new mobile number.
                                </p>
                                <p className="text-xs bg-slate-50 border border-border rounded-lg px-3 py-2 text-foreground font-medium">
                                  New number: {otpModal.newValue}
                                </p>
                              </div>
                            )}
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="Enter 6-digit OTP"
                              value={otpInput}
                              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                              className="w-full px-4 py-3 text-center text-lg font-bold tracking-widest border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                            <div className="flex gap-2">
                              <Button variant="primary" size="sm" onClick={verifyContactOtp}
                                disabled={otpVerifying || otpInput.length !== 6}
                                className="flex-1">
                                {otpVerifying ? "Verifying…" : "Confirm"}
                              </Button>
                              <button onClick={resendOtp} disabled={otpSending}
                                className="text-xs text-primary font-semibold hover:underline disabled:opacity-50 px-2">
                                Resend
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                            <button onClick={resendOtp}
                              className="text-sm text-primary font-semibold hover:underline">Retry sending OTP</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Change password */}
                <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                  <h2 className="font-bold text-base mb-4">Change Password</h2>
                  <form onSubmit={savePassword} className="space-y-4">
                    {(["currentPassword", "newPassword", "confirmPassword"] as const).map((field) => {
                      const labels = { currentPassword: "Current Password", newPassword: "New Password", confirmPassword: "Confirm New Password" };
                      const keys = { currentPassword: "current", newPassword: "new", confirmPassword: "confirm" } as const;
                      const k = keys[field];
                      return (
                        <div key={field}>
                          <label className="text-xs font-medium text-muted-foreground block mb-1">{labels[field]}</label>
                          <div className="relative">
                            <input
                              type={showPw[k] ? "text" : "password"}
                              value={pwForm[field]}
                              onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                              required
                              className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw((p) => ({ ...p, [k]: !p[k] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPw[k] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {pwError && <p className="text-sm text-destructive">{pwError}</p>}
                    {pwSuccess && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <Check className="w-4 h-4" /> Password changed successfully!
                      </div>
                    )}

                    <Button type="submit" variant="outline" size="sm" disabled={pwSaving}>
                      {pwSaving ? "Changing…" : "Change Password"}
                    </Button>
                  </form>
                </div>
              </>
            )}

            {/* ── ADDRESSES TAB ──────────────────────────────────────────── */}
            {activeTab === "addresses" && (
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Saved Addresses
                  </h2>
                  {!showAddForm && !editingAddr && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Add Address
                    </Button>
                  )}
                </div>

                {addrLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {showAddForm && (
                      <div className="mb-4">
                        <AddressForm onSave={handleAddAddress} onCancel={() => setShowAddForm(false)} saving={addrSaving} />
                      </div>
                    )}

                    {addresses.length === 0 && !showAddForm && (
                      <div className="text-center py-12 text-muted-foreground">
                        <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No saved addresses</p>
                        <p className="text-sm mt-1">Add an address to make checkout faster.</p>
                        <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
                          <Plus className="w-4 h-4 mr-1" /> Add Address
                        </Button>
                      </div>
                    )}

                    <div className="space-y-3">
                      {addresses.map((addr) => (
                        <div key={addr._id}>
                          {editingAddr?._id === addr._id ? (
                            <AddressForm
                              initial={addr}
                              onSave={handleUpdateAddress}
                              onCancel={() => setEditingAddr(null)}
                              saving={addrSaving}
                            />
                          ) : (
                            <div className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                              addr.isDefault ? "border-primary bg-primary/5" : "border-border"
                            }`}>
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  addr.isDefault ? "bg-primary text-white" : "bg-slate-100 text-muted-foreground"
                                }`}>
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{addr.label}</span>
                                    {addr.isDefault && (
                                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Default</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-0.5">{addr.street}</p>
                                  <p className="text-sm text-muted-foreground">{addr.city}, {addr.state} {addr.zipCode}</p>
                                  <p className="text-sm text-muted-foreground">{addr.country}</p>
                                  {addr.phone && <p className="text-sm text-muted-foreground">📱 {addr.phone}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => setEditingAddr(addr)}
                                  className="p-2 rounded-lg hover:bg-slate-100 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAddress(addr._id)}
                                  className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ORDERS TAB ─────────────────────────────────────────────── */}
            {activeTab === "orders" && (
              <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                <h2 className="font-bold text-base mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary" /> Previous Orders
                </h2>

                {ordersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No orders yet</p>
                    <p className="text-sm mt-1">Your order history will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => {
                      const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.Pending;
                      const expanded = expandedOrder === order._id;
                      const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric"
                      });

                      return (
                        <div key={order._id} className="rounded-xl border border-border overflow-hidden">
                          {/* Order header */}
                          <button
                            onClick={() => setExpandedOrder(expanded ? null : order._id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Order ID</p>
                                <p className="font-mono text-sm font-medium">#{order._id.slice(-8).toUpperCase()}</p>
                              </div>
                              <div className="hidden sm:block">
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="text-sm font-medium">{orderDate}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Items</p>
                                <p className="text-sm font-medium">{order.items.length}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="text-sm font-bold text-primary">${order.totalPrice.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                                {cfg.icon} {order.status}
                              </span>
                              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </button>

                          {/* Expanded details */}
                          {expanded && (
                            <div className="border-t border-border p-4 bg-slate-50/50 space-y-4">
                              {/* Items */}
                              <div className="space-y-3">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-border flex-shrink-0">
                                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Price breakdown */}
                              <div className="rounded-lg bg-white border border-border p-3 space-y-1.5 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Subtotal</span><span>${order.itemsPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Shipping</span>
                                  <span>{order.shippingPrice === 0 ? "Free" : `$${order.shippingPrice.toFixed(2)}`}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Tax</span><span>${order.taxPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t border-border pt-1.5">
                                  <span>Total</span><span className="text-primary">${order.totalPrice.toFixed(2)}</span>
                                </div>
                              </div>

                              {/* Shipping address */}
                              <div className="text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-0.5 flex items-center gap-1.5">
                                  <Truck className="w-3.5 h-3.5" /> Shipped to
                                </p>
                                <p>{order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}, {order.shippingAddress.country}</p>
                              </div>

                              <p className="text-xs text-muted-foreground">
                                Payment: <span className="capitalize font-medium text-foreground">{order.paymentMethod}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── HELP TAB ───────────────────────────────────────────────── */}
            {activeTab === "help" && (
              <>
                {/* FAQ */}
                <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                  <h2 className="font-bold text-base mb-4 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary" /> Frequently Asked Questions
                  </h2>
                  <div className="space-y-2">
                    {FAQS.map((faq, i) => (
                      <div key={i} className={`rounded-xl border overflow-hidden transition-all ${openFaq === i ? "border-primary/30" : "border-border"}`}>
                        <button
                          onClick={() => setOpenFaq(openFaq === i ? null : i)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                          {faq.q}
                          {openFaq === i
                            ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        </button>
                        {openFaq === i && (
                          <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border bg-slate-50/50">
                            <p className="pt-3">{faq.a}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact form */}
                <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
                  <h2 className="font-bold text-base mb-1">Contact Support</h2>
                  <p className="text-sm text-muted-foreground mb-4">Our team typically responds within 24 hours.</p>
                  <ContactForm userEmail={authUser?.email ?? ""} />
                </div>

                {/* Quick contact */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: "📧", label: "Email Us", value: "support@shophub.com", sub: "24/7 support" },
                    { icon: "💬", label: "Live Chat", value: "Available 9am–6pm", sub: "Mon–Fri" },
                    { icon: "📞", label: "Call Us", value: "+1 (800) 123-4567", sub: "Business hours" },
                  ].map((c) => (
                    <div key={c.label} className="bg-white rounded-2xl border border-border p-4 text-center">
                      <div className="text-2xl mb-2">{c.icon}</div>
                      <p className="font-semibold text-sm">{c.label}</p>
                      <p className="text-sm text-primary font-medium mt-0.5">{c.value}</p>
                      <p className="text-xs text-muted-foreground">{c.sub}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm({ userEmail }: { userEmail: string }) {
  const [form, setForm] = useState({ subject: "", message: "", email: userEmail });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate send (no actual email endpoint; just UI feedback)
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setForm((p) => ({ ...p, subject: "", message: "" }));
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <p className="font-semibold text-green-700">Message sent!</p>
        <p className="text-sm text-muted-foreground mt-1">We'll get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Your Email</label>
        <input value={form.email} onChange={f("email")} type="email" required
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
        <select value={form.subject} onChange={f("subject")} required
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
          <option value="">Select a topic…</option>
          <option>Order Issue</option>
          <option>Return / Refund</option>
          <option>Account Problem</option>
          <option>Payment Issue</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Message</label>
        <textarea value={form.message} onChange={f("message")} required rows={4} placeholder="Describe your issue in detail…"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
      <Button type="submit" variant="primary" size="sm">Send Message</Button>
    </form>
  );
}
