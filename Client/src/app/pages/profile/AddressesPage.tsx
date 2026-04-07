import React, { useState, useEffect } from "react";
import { MapPin, Plus, Edit2, Trash2 } from "lucide-react";
import { authService, AddressData } from "../../../services/authService";
import { Button } from "../../components/Button";

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

  const addrValid =
    !!(form.phone ?? "").trim() &&
    !!form.zipCode.trim() &&
    !!form.street.trim() &&
    !!form.city.trim() &&
    !!form.state.trim() &&
    !!form.country.trim();

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
          <input
            value={form.label}
            onChange={f("label")}
            placeholder="Home / Work / Other"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Mobile Number <span className="text-destructive">*</span>
          </label>
          <input
            value={(form as any).phone ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+91 98765 43210"
            type="tel"
            required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Country</label>
          <input
            value={form.country}
            onChange={f("country")}
            placeholder="United States"
            required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Street Address</label>
        <input
          value={form.street}
          onChange={f("street")}
          placeholder="123 Main St, Apt 4B"
          required
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
          <input
            value={form.city}
            onChange={f("city")}
            placeholder="New York"
            required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">State</label>
          <input
            value={form.state}
            onChange={f("state")}
            placeholder="NY"
            required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            ZIP / Pincode <span className="text-destructive">*</span>
          </label>
          <input
            value={form.zipCode}
            onChange={f("zipCode")}
            placeholder="10001"
            required
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!form.isDefault}
          onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
          className="rounded accent-primary"
        />
        <span>Set as default address</span>
      </label>
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={saving || !addrValid}>
          {saving ? "Saving…" : "Save Address"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authService
      .getMe()
      .then((res) => setAddresses(res.data.user?.addresses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (data: AddressData) => {
    setSaving(true);
    try {
      const res = await authService.addAddress(data);
      setAddresses(res.data.addresses);
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: AddressData) => {
    if (!editingAddr) return;
    setSaving(true);
    try {
      const res = await authService.updateAddress(editingAddr._id, data);
      setAddresses(res.data.addresses);
      setEditingAddr(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    const res = await authService.deleteAddress(id);
    setAddresses(res.data.addresses);
  };

  return (
    <div className="py-2">
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {showAddForm && (
            <div className="mb-4">
              <AddressForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} saving={saving} />
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
                    onSave={handleUpdate}
                    onCancel={() => setEditingAddr(null)}
                    saving={saving}
                  />
                ) : (
                  <div
                    className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                      addr.isDefault ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          addr.isDefault ? "bg-primary text-white" : "bg-slate-100 text-muted-foreground"
                        }`}
                      >
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
                        <p className="text-sm text-muted-foreground">
                          {addr.city}, {addr.state} {addr.zipCode}
                        </p>
                        <p className="text-sm text-muted-foreground">{addr.country}</p>
                        {addr.phone && (
                          <p className="text-sm text-muted-foreground">📱 {addr.phone}</p>
                        )}
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
                        onClick={() => handleDelete(addr._id)}
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
  );
}
