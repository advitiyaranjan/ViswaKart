import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Store, Trash2, ExternalLink } from "lucide-react";
import { authService } from "../../../services/authService";
import { userService } from "../../../services/userService";
import { productService, categoryService } from "../../../services/productService";
import { Button } from "../../components/Button";
import { ProductImage } from "../../components/ProductImage";
import ImageUploader from "../../components/ImageUploader";
import { formatCurrency } from "../../../lib/currency";
import { getProductPricing } from "../../../lib/commerce";

interface ServerUser {
  _id: string;
  name: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
  isSeller?: boolean;
  sellerApproved?: boolean;
  sellerRequested?: boolean;
  sellerProfile?: { name?: string; hostelNumber?: string; roomNumber?: string; courseYear?: string; mobileNumber?: string };
}

interface Listing {
  _id: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
  sold?: boolean;
  isActive?: boolean;
  images?: string[];
  category?: { name: string };
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

const EMPTY_DRAFT: Draft = {
  name: "",
  price: "",
  originalPrice: "",
  stock: "1",
  description: "",
  specs: "",
  category: "",
  productAge: "",
  images: [],
  sellerMobile: "",
  sellerHostel: "",
  sellerRoom: "",
};
const fieldClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function readDraft(key: string): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") ?? {};
  } catch {
    return {};
  }
}

export default function SellProductPage() {
  const [serverUser, setServerUser] = useState<ServerUser | null>(null);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [requestMobile, setRequestMobile] = useState("");
  const [requesting, setRequesting] = useState(false);
  const draftKey = `sell:draft:${serverUser?._id || "anon"}`;

  useEffect(() => {
    let active = true;
    Promise.all([authService.getMe(), categoryService.getCategories()])
      .then(([me, cats]) => {
        if (!active) return;
        const user: ServerUser = me.data.user;
        setServerUser(user);
        setCategories(cats.data?.categories ?? []);
        const saved = readDraft(`sell:draft:${user._id}`);
        setDraft({
          ...EMPTY_DRAFT,
          ...saved,
          images: Array.isArray(saved.images) ? saved.images : [],
          sellerMobile: saved.sellerMobile || user.sellerProfile?.mobileNumber || "",
          sellerHostel: saved.sellerHostel || user.sellerProfile?.hostelNumber || "",
          sellerRoom: saved.sellerRoom || user.sellerProfile?.roomNumber || "",
        });
        setRequestMobile(user.sellerProfile?.mobileNumber || "");
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const eligible = Boolean(
    serverUser &&
    (serverUser.role === "admin" ||
      (serverUser.isSeller && serverUser.sellerApproved) ||
      (serverUser.isVerified && serverUser.email?.toLowerCase().endsWith("@iiitm.ac.in"))),
  );

  useEffect(() => {
    if (!serverUser || !eligible) return;
    productService
      .getProducts({ seller: serverUser._id, limit: 50 })
      .then((res) => setListings(res.data.products ?? []))
      .catch(() => {});
  }, [serverUser, eligible]);

  // Autosave so a half-written listing survives closing the dialog.
  useEffect(() => {
    if (!serverUser) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        /* storage unavailable */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, draftKey, serverUser]);

  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const preview = useMemo(() => {
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    return getProductPricing({ price, originalPrice: Number(draft.originalPrice) || price });
  }, [draft.price, draft.originalPrice]);

  function validate() {
    const next: Partial<Record<keyof Draft, string>> = {};
    const price = Number(draft.price);
    const original = draft.originalPrice.trim() ? Number(draft.originalPrice) : price;
    const stock = Number(draft.stock);
    if (draft.name.trim().length < 2) next.name = "Give your product a name.";
    if (!Number.isFinite(price) || price <= 0) next.price = "Enter the price buyers will pay.";
    else if (!Number.isFinite(original) || original < price) next.originalPrice = "Original price can't be lower than your selling price.";
    if (!Number.isInteger(stock) || stock < 1 || stock > 999) next.stock = "Enter how many you have (1–999).";
    if (!draft.category) next.category = "Choose a category.";
    if (draft.description.trim().length < 10) next.description = "Describe the product in at least 10 characters.";
    if (!/^[0-9]{7,15}$/.test(draft.sellerMobile.replace(/\D/g, ""))) next.sellerMobile = "Enter a 7–15 digit mobile number.";
    if (!draft.sellerHostel.trim()) next.sellerHostel = "Required so buyers can collect.";
    if (!draft.sellerRoom.trim()) next.sellerRoom = "Required so buyers can collect.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function createListing(event: FormEvent) {
    event.preventDefault();
    if (!validate() || !serverUser) return;
    const price = Math.round(Number(draft.price) * 100) / 100;
    const originalPrice = draft.originalPrice.trim() ? Math.round(Number(draft.originalPrice) * 100) / 100 : price;
    setSaving(true);
    try {
      const res = await productService.createProduct({
        name: draft.name.trim(),
        description: draft.description.trim(),
        price,
        originalPrice,
        stock: Number(draft.stock),
        specifications: draft.specs.trim() || undefined,
        category: draft.category,
        productAge: draft.productAge.trim(),
        images: draft.images.filter(Boolean),
        sellerMobile: draft.sellerMobile.replace(/\D/g, ""),
        sellerHostelNumber: draft.sellerHostel.trim(),
        sellerRoomNumber: draft.sellerRoom.trim(),
      });
      const created: Listing | undefined = res.data?.product;
      if (created) {
        setListings((prev) => [created, ...prev.filter((p) => p._id !== created._id)]);
        window.dispatchEvent(new CustomEvent("app:productCreated", { detail: created }));
      }
      setDraft({ ...EMPTY_DRAFT, sellerMobile: draft.sellerMobile, sellerHostel: draft.sellerHostel, sellerRoom: draft.sellerRoom });
      setErrors({});
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* storage unavailable */
      }
      toast.success("Your product is live in the store");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Your product couldn't be listed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeListing(listing: Listing) {
    if (!window.confirm(`Remove “${listing.name}” from the store? Existing orders are not affected.`)) return;
    setRemoving(listing._id);
    try {
      await productService.deleteProduct(listing._id);
      setListings((prev) => prev.map((p) => (p._id === listing._id ? { ...p, isActive: false } : p)));
      toast.success("Listing removed");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "The listing couldn't be removed.");
    } finally {
      setRemoving(null);
    }
  }

  async function requestAccess(event: FormEvent) {
    event.preventDefault();
    if (!/^[0-9]{7,15}$/.test(requestMobile.replace(/\D/g, ""))) {
      toast.error("Enter a valid mobile number so the admin can reach you.");
      return;
    }
    setRequesting(true);
    try {
      await userService.requestSellerAccess({ mobileNumber: requestMobile.replace(/\D/g, ""), message: "Requested via app" });
      setServerUser((user) => (user ? { ...user, sellerRequested: true } : user));
      toast.success("Request sent. We'll let you know once an admin approves it.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Your request couldn't be sent.");
    } finally {
      setRequesting(false);
    }
  }

  if (loading) return <p className="py-6 text-muted-foreground">Loading…</p>;
  if (loadError || !serverUser)
    return <p className="py-6 text-destructive">We couldn't load your seller details. Please close this window and try again.</p>;

  if (!eligible) {
    return (
      <div className="space-y-4 py-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Store className="h-5 w-5 text-primary" /> Sell on ViswaKart
        </h2>
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="mb-1 font-medium">Selling is open to verified IIITM accounts.</p>
          <p className="mb-4 text-sm text-muted-foreground">Using a different email? Ask an admin for seller access and we'll review it.</p>
          {serverUser.sellerRequested ? (
            <p className="rounded-lg bg-accent/40 p-3 text-sm text-accent-foreground">Your request is waiting for admin approval.</p>
          ) : (
            <form onSubmit={requestAccess} className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="request-mobile" className="sr-only">
                Mobile number
              </label>
              <input
                id="request-mobile"
                type="tel"
                inputMode="tel"
                placeholder="Your mobile number"
                value={requestMobile}
                onChange={(event) => setRequestMobile(event.target.value)}
                className={fieldClass}
              />
              <Button type="submit" disabled={requesting} className="shrink-0">
                {requesting ? "Sending…" : "Request access"}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const fieldError = (key: keyof Draft) =>
    errors[key] ? (
      <p id={`sell-${key}-error`} className="mt-1 text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null;
  const aria = (key: keyof Draft) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `sell-${key}-error` : undefined,
  });

  return (
    <div className="space-y-6 py-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Store className="h-5 w-5 text-primary" /> Sell a product
        </h2>
        <p className="text-sm text-muted-foreground">Buyers pay cash when they collect. Manage handovers in the Seller Orders tab.</p>
      </div>

      <form onSubmit={createListing} noValidate className="space-y-4 rounded-xl border border-border bg-white p-5">
        <div>
          <label htmlFor="sell-name" className="mb-1 block text-sm font-medium">
            Product name
          </label>
          <input id="sell-name" value={draft.name} onChange={set("name")} maxLength={200} className={fieldClass} {...aria("name")} />
          {fieldError("name")}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="sell-price" className="mb-1 block text-sm font-medium">
              Selling price (₹)
            </label>
            <input
              id="sell-price"
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              value={draft.price}
              onChange={set("price")}
              className={fieldClass}
              {...aria("price")}
            />
            {fieldError("price")}
          </div>
          <div>
            <label htmlFor="sell-original" className="mb-1 block text-sm font-medium">
              Original price <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="sell-original"
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              value={draft.originalPrice}
              onChange={set("originalPrice")}
              className={fieldClass}
              {...aria("originalPrice")}
            />
            {fieldError("originalPrice")}
          </div>
          <div>
            <label htmlFor="sell-stock" className="mb-1 block text-sm font-medium">
              Quantity
            </label>
            <input
              id="sell-stock"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              step={1}
              value={draft.stock}
              onChange={set("stock")}
              className={fieldClass}
              {...aria("stock")}
            />
            {fieldError("stock")}
          </div>
        </div>
        {preview && (
          <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary" aria-live="polite">
            Buyers pay <strong>{formatCurrency(preview.price)}</strong>
            {preview.discount > 0 && (
              <>
                {" "}
                — shown as {preview.discount}% off {formatCurrency(preview.originalPrice)}
              </>
            )}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sell-category" className="mb-1 block text-sm font-medium">
              Category
            </label>
            <select id="sell-category" value={draft.category} onChange={set("category")} className={fieldClass} {...aria("category")}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldError("category")}
          </div>
          <div>
            <label htmlFor="sell-age" className="mb-1 block text-sm font-medium">
              How long have you used it? <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input id="sell-age" placeholder="e.g. 6 months" value={draft.productAge} onChange={set("productAge")} className={fieldClass} />
          </div>
        </div>

        <div>
          <label htmlFor="sell-description" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="sell-description"
            rows={3}
            value={draft.description}
            onChange={set("description")}
            placeholder="Condition, what's included, why you're selling…"
            className={fieldClass}
            {...aria("description")}
          />
          {fieldError("description")}
        </div>

        <div>
          <label htmlFor="sell-specs" className="mb-1 block text-sm font-medium">
            Specifications <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="sell-specs"
            rows={3}
            value={draft.specs}
            onChange={set("specs")}
            placeholder="Brand, model, size…"
            className={fieldClass}
          />
        </div>

        <fieldset className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
          <legend className="float-left mb-1 w-full text-sm font-semibold sm:col-span-3">Pickup details for buyers</legend>
          <div>
            <label htmlFor="sell-mobile" className="mb-1 block text-sm font-medium">
              Mobile
            </label>
            <input
              id="sell-mobile"
              type="tel"
              inputMode="tel"
              value={draft.sellerMobile}
              onChange={set("sellerMobile")}
              className={fieldClass}
              {...aria("sellerMobile")}
            />
            {fieldError("sellerMobile")}
          </div>
          <div>
            <label htmlFor="sell-hostel" className="mb-1 block text-sm font-medium">
              Hostel
            </label>
            <input
              id="sell-hostel"
              placeholder="e.g. BH-2"
              value={draft.sellerHostel}
              onChange={set("sellerHostel")}
              className={fieldClass}
              {...aria("sellerHostel")}
            />
            {fieldError("sellerHostel")}
          </div>
          <div>
            <label htmlFor="sell-room" className="mb-1 block text-sm font-medium">
              Room
            </label>
            <input
              id="sell-room"
              placeholder="e.g. 101"
              value={draft.sellerRoom}
              onChange={set("sellerRoom")}
              className={fieldClass}
              {...aria("sellerRoom")}
            />
            {fieldError("sellerRoom")}
          </div>
        </fieldset>

        <div>
          <p className="mb-1 text-sm font-medium">Photos</p>
          <p className="mb-2 text-xs text-muted-foreground">Up to 6 photos. The first one is the cover.</p>
          <ImageUploader
            images={draft.images}
            onChange={(images: string[]) => setDraft((current) => ({ ...current, images }))}
            max={6}
            onUploadingChange={setImagesUploading}
          />
        </div>

        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={saving || imagesUploading}>
          {saving ? "Listing…" : imagesUploading ? "Uploading photos…" : "List product"}
        </Button>
      </form>

      <section>
        <h3 className="mb-3 font-semibold">Your listings</h3>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            You haven't listed anything yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {listings.map((listing) => {
              const state =
                listing.isActive === false ? "Removed" : listing.sold || listing.stock <= 0 ? "Sold out" : `${listing.stock} available`;
              return (
                <li key={listing._id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
                  <ProductImage
                    src={listing.images?.[0]}
                    alt={listing.name}
                    className="h-14 w-14 shrink-0 rounded-lg bg-muted object-contain p-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{listing.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(listing.price)} · {state}
                    </p>
                  </div>
                  {listing.isActive !== false && (
                    <>
                      <a
                        href={`/products/${listing._id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${listing.name} in the store`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        aria-label={`Remove ${listing.name}`}
                        disabled={removing === listing._id}
                        onClick={() => void removeListing(listing)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
