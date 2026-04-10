import React, { useState, useEffect } from "react";
import { MapPin, Plus, Edit2, Trash2 } from "lucide-react";
import { authService, AddressData } from "../../../services/authService";
import { Button } from "../../components/Button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, AddressFormValues } from "../../../lib/validationSchemas";

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
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    mode: "onBlur",
    defaultValues: {
      label: initial.label ?? "Home",
      phone: (initial as any).phone ?? "",
      street: initial.street ?? "",
      city: initial.city ?? "",
      state: initial.state ?? "",
      zipCode: initial.zipCode ?? "",
      country: initial.country ?? "",
      isDefault: initial.isDefault ?? false,
    },
  });

  const labelValue = watch("label");

  const onSubmit = (data: AddressFormValues) => {
    onSave(data as AddressData);
  };

  const inputCls = (error?: { message?: string }) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${
      error ? "border-destructive focus:ring-destructive/30" : "border-border"
    }`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Label</label>
          <div className="flex gap-1.5">
            {["Home", "Work", "Other"].map((l) => (
              <button key={l} type="button"
                onClick={() => setValue("label", l)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  labelValue === l ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Mobile Number <span className="text-destructive">*</span>
          </label>
          <input
            {...register("phone")}
            placeholder="+91 98765 43210"
            type="tel"
            className={inputCls(errors.phone)}
          />
          {errors.phone ? <p className="text-destructive text-xs mt-1">{errors.phone.message}</p> : <p className="text-muted-foreground text-[10px] mt-0.5">Format: +CountryCode Number (e.g. +91 98765 43210)</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Country <span className="text-destructive">*</span></label>
          <input
            {...register("country")}
            placeholder="United States"
            className={inputCls(errors.country)}
          />
          {errors.country && <p className="text-destructive text-xs mt-1">{errors.country.message}</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Street Address <span className="text-destructive">*</span></label>
        <input
          {...register("street")}
          placeholder="123 Main St, Apt 4B"
          className={inputCls(errors.street)}
        />
        {errors.street && <p className="text-destructive text-xs mt-1">{errors.street.message}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">City <span className="text-destructive">*</span></label>
          <input
            {...register("city")}
            placeholder="New York"
            className={inputCls(errors.city)}
          />
          {errors.city && <p className="text-destructive text-xs mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">State <span className="text-destructive">*</span></label>
          <input
            {...register("state")}
            placeholder="NY"
            className={inputCls(errors.state)}
          />
          {errors.state && <p className="text-destructive text-xs mt-1">{errors.state.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            ZIP / Pincode <span className="text-destructive">*</span>
          </label>
          <input
            {...register("zipCode")}
            placeholder="10001"
            className={inputCls(errors.zipCode)}
          />
          {errors.zipCode ? <p className="text-destructive text-xs mt-1">{errors.zipCode.message}</p> : <p className="text-muted-foreground text-[10px] mt-0.5">e.g. 10001 or SW1A 1AA</p>}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          {...register("isDefault")}
          className="rounded accent-primary"
        />
        <span>Set as default address</span>
      </label>
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={saving}>
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
