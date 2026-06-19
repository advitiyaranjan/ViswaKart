import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { productService } from "../../../services/productService";
import { formatCurrency } from "../../../lib/currency";
import { getProductPricing } from "../../../lib/commerce";
import type { SellerProfile } from "../../../lib/seller";
import { Button } from "../../components/Button";
import ImageUploader from "../../components/ImageUploader";
import { sellerFieldClass } from "./SellerShell";

export interface Listing {
  _id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  sold?: boolean;
  isActive?: boolean;
  images?: string[];
  productAge?: string;
  specifications?: string | Record<string, unknown> | null;
  category?: { _id: string; name: string; slug?: string } | string;
  sellerMobile?: string;
  sellerHostelNumber?: string;
  sellerRoomNumber?: string;
  updatedAt?: string;
}

interface Draft {
  name: string;
  price: string;
  originalPrice: string;
  stock: string;
  description: string;
  specs: string;
  category: string;
  productAge: string;
  images: string[];
  sellerMobile: string;
  sellerHostel: string;
  sellerRoom: string;
}

export const MAX_STOCK = 100000;

function specsToText(specs: Listing["specifications"]) {
  if (!specs) return "";
  if (typeof specs === "string") return specs;
  return Object.entries(specs)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join("\n");
}

function draftFrom(listing: Listing | null, profile: SellerProfile): Draft {
  if (!listing) {
    return {
      name: "", price: "", originalPrice: "", stock: "1", description: "", specs: "", category: "", productAge: "", images: [],
      sellerMobile: profile.mobileNumber, sellerHostel: profile.hostelNumber, sellerRoom: profile.roomNumber,
    };
  }
  return {
    name: listing.name,
    price: String(listing.price),
    originalPrice: listing.originalPrice && listing.originalPrice > listing.price ? String(listing.originalPrice) : "",
    stock: String(listing.stock ?? 0),
    description: listing.description || "",
    specs: specsToText(listing.specifications),
    category: typeof listing.category === "string" ? listing.category : listing.category?._id || "",
    productAge: listing.productAge || "",
    images: listing.images ?? [],
    sellerMobile: listing.sellerMobile || profile.mobileNumber,
    sellerHostel: listing.sellerHostelNumber || profile.hostelNumber,
    sellerRoom: listing.sellerRoomNumber || profile.roomNumber,
  };
}

/** Mirrors the server's product rules so most mistakes are caught before a request is sent. */
export function validateDraft(draft: Draft, editing: boolean) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  const price = Number(draft.price);
  const original = draft.originalPrice.trim() ? Number(draft.originalPrice) : price;
  const stock = Number(draft.stock);
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 200) errors.name = "Give your product a name (2–200 characters).";
  if (!draft.price.trim() || !Number.isFinite(price) || price <= 0) errors.price = "Enter the price buyers will pay.";
  else if (!Number.isFinite(original) || original < price) errors.originalPrice = "Original price can't be lower than your selling price.";
  if (!draft.stock.trim() || !Number.isInteger(stock) || stock < (editing ? 0 : 1) || stock > MAX_STOCK)
    errors.stock = editing ? `Enter a whole number from 0 to ${MAX_STOCK}.` : `Enter how many you have (1–${MAX_STOCK}).`;
  if (!draft.category) errors.category = "Choose a category.";
  const description = draft.description.trim();
  if (description.length < 10 || description.length > 5000) errors.description = "Describe the product in 10–5000 characters.";
  if (draft.specs.length > 5000) errors.specs = "Keep specifications under 5000 characters.";
  if (!/^[0-9]{7,15}$/.test(draft.sellerMobile.replace(/\D/g, ""))) errors.sellerMobile = "Enter a 7–15 digit mobile number.";
  if (!draft.sellerHostel.trim()) errors.sellerHostel = "Required so buyers can collect.";
  if (!draft.sellerRoom.trim()) errors.sellerRoom = "Required so buyers can collect.";
  return errors;
}

function readStoredDraft(key: string): Partial<Draft> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

interface Props {
  userId: string;
  listing: Listing | null;
  categories: { _id: string; name: string }[];
  profile: SellerProfile;
  onSaved: (product: Listing, created: boolean) => void;
  onCancel?: () => void;
}

export default function ProductForm({ userId, listing, categories, profile, onSaved, onCancel }: Props) {
  const editing = Boolean(listing);
  const draftKey = `sell:draft:${userId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    const base = draftFrom(listing, profile);
    if (listing) return base;
    // New listings restore an unsent draft, so closing the tab doesn't lose work.
    const saved = readStoredDraft(draftKey);
    return { ...base, ...saved, images: Array.isArray(saved.images) ? saved.images.filter((url) => typeof url === "string") : [] };
  });
  const [initialSpecs] = useState(() => specsToText(listing?.specifications));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (editing) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        /* storage unavailable */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, draftKey, editing]);

  const set = (key: keyof Draft) => (event: { target: { value: string } }) => {
    setDraft((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const preview = useMemo(() => {
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    return getProductPricing({ price, originalPrice: Number(draft.originalPrice) || price });
  }, [draft.price, draft.originalPrice]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || imagesUploading) return;
    const found = validateDraft(draft, editing);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`sell-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    const price = Math.round(Number(draft.price) * 100) / 100;
    const payload: Record<string, unknown> = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      price,
      originalPrice: draft.originalPrice.trim() ? Math.round(Number(draft.originalPrice) * 100) / 100 : price,
      stock: Number(draft.stock),
      category: draft.category,
      productAge: draft.productAge.trim(),
      images: draft.images.filter(Boolean),
      sellerMobile: draft.sellerMobile.replace(/\D/g, ""),
      sellerHostelNumber: draft.sellerHostel.trim(),
      sellerRoomNumber: draft.sellerRoom.trim(),
    };
    // Structured specifications from older listings are kept unless the seller actually edits them.
    if (!editing || draft.specs !== initialSpecs) payload.specifications = draft.specs.trim() || null;
    setSaving(true);
    setSubmitError("");
    try {
      const res = listing ? await productService.updateProduct(listing._id, payload) : await productService.createProduct(payload);
      const saved: Listing = res.data.product;
      if (!listing) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* storage unavailable */
        }
        window.dispatchEvent(new CustomEvent("app:productCreated", { detail: saved }));
      }
      toast.success(listing ? "Listing updated" : saved.isActive === false ? "Listing saved" : "Your product is live in the store");
      onSaved(saved, !listing);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || "Your listing couldn't be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key: keyof Draft) =>
    errors[key] ? (
      <p id={`sell-${key}-error`} className="mt-1 text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null;
  const aria = (key: keyof Draft) => ({
    id: `sell-${key}`,
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `sell-${key}-error` : undefined,
  });
  const label = (key: keyof Draft, text: string, optional = false) => (
    <label htmlFor={`sell-${key}`} className="mb-1.5 block text-sm font-medium">
      {text} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Product details</h3>
        <div>
          {label("name", "Product name")}
          <input value={draft.name} onChange={set("name")} maxLength={200} className={sellerFieldClass} {...aria("name")} />
          {fieldError("name")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {label("category", "Category")}
            <select value={draft.category} onChange={set("category")} className={sellerFieldClass} {...aria("category")}>
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldError("category")}
          </div>
          <div>
            {label("productAge", "How long have you used it?", true)}
            <input placeholder="e.g. 6 months, or New" value={draft.productAge} onChange={set("productAge")} maxLength={100} className={sellerFieldClass} id="sell-productAge" />
          </div>
        </div>
        <div>
          {label("description", "Description")}
          <textarea rows={4} value={draft.description} onChange={set("description")} maxLength={5000} placeholder="Condition, what's included, why you're selling…" className={sellerFieldClass} {...aria("description")} />
          <div className="flex justify-between gap-3">
            {fieldError("description") ?? <span />}
            <span className="mt-1 text-xs text-muted-foreground">{draft.description.trim().length}/5000</span>
          </div>
        </div>
        <div>
          {label("specs", "Specifications", true)}
          <textarea rows={3} value={draft.specs} onChange={set("specs")} maxLength={5000} placeholder={"Brand: …\nModel: …\nSize: …"} className={sellerFieldClass} {...aria("specs")} />
          {fieldError("specs")}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Price & inventory</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            {label("price", "Selling price (₹)")}
            <input type="number" inputMode="decimal" min={1} step="0.01" value={draft.price} onChange={set("price")} className={sellerFieldClass} {...aria("price")} />
            {fieldError("price")}
          </div>
          <div>
            {label("originalPrice", "Original price (₹)", true)}
            <input type="number" inputMode="decimal" min={1} step="0.01" value={draft.originalPrice} onChange={set("originalPrice")} className={sellerFieldClass} {...aria("originalPrice")} />
            {fieldError("originalPrice")}
          </div>
          <div>
            {label("stock", "Quantity available")}
            <input type="number" inputMode="numeric" min={editing ? 0 : 1} max={MAX_STOCK} step={1} value={draft.stock} onChange={set("stock")} className={sellerFieldClass} {...aria("stock")} />
            {fieldError("stock")}
          </div>
        </div>
        {preview && (
          <p className="rounded-xl bg-primary/5 px-3 py-2 text-sm text-primary" aria-live="polite">
            Buyers pay <strong>{formatCurrency(preview.price)}</strong>
            {preview.discount > 0 && <> — shown as {preview.discount}% off {formatCurrency(preview.originalPrice)}</>}
          </p>
        )}
      </section>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pickup details for buyers</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            {label("sellerMobile", "Mobile")}
            <input type="tel" inputMode="tel" autoComplete="tel" value={draft.sellerMobile} onChange={set("sellerMobile")} className={sellerFieldClass} {...aria("sellerMobile")} />
            {fieldError("sellerMobile")}
          </div>
          <div>
            {label("sellerHostel", "Hostel / block")}
            <input placeholder="e.g. BH-2" maxLength={50} value={draft.sellerHostel} onChange={set("sellerHostel")} className={sellerFieldClass} {...aria("sellerHostel")} />
            {fieldError("sellerHostel")}
          </div>
          <div>
            {label("sellerRoom", "Room")}
            <input placeholder="e.g. 101" maxLength={50} value={draft.sellerRoom} onChange={set("sellerRoom")} className={sellerFieldClass} {...aria("sellerRoom")} />
            {fieldError("sellerRoom")}
          </div>
        </div>
      </fieldset>

      <section>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Photos</h3>
        <p className="mb-3 text-sm text-muted-foreground">Up to 6 photos (JPEG, PNG, WebP or GIF). The first one is the cover.</p>
        <ImageUploader images={draft.images} onChange={(images: string[]) => setDraft((current) => ({ ...current, images }))} max={6} onUploadingChange={setImagesUploading} />
      </section>

      {submitError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {submitError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={saving || imagesUploading}>
          {saving ? "Saving…" : imagesUploading ? "Uploading photos…" : editing ? "Save changes" : "Publish listing"}
        </Button>
      </div>
    </form>
  );
}
