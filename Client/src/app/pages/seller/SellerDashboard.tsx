import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ExternalLink, GraduationCap, PackageOpen, Pencil, Plus, RefreshCw } from "lucide-react";
import { productService, categoryService } from "../../../services/productService";
import { formatCurrency } from "../../../lib/currency";
import { SELL_PATHS, type SellerSummary } from "../../../lib/seller";
import { useAuth } from "../../../context/AuthContext";
import { Button, buttonClass } from "../../components/Button";
import { ProductImage } from "../../components/ProductImage";
import SellerOrdersPage from "../profile/SellerOrdersPage";
import ProductForm, { type Listing } from "./ProductForm";
import { SellerGate, SellerPageFrame } from "./SellerShell";
import { CollegeList } from "../../components/college/CollegeList";
import { collegeService } from "../../../services/collegeService";
import type { College } from "../../../lib/college";

type Tab = "listings" | "new" | "orders";

function listingState(listing: Listing) {
  if (listing.isActive === false) return { label: "Hidden", className: "border-slate-200 bg-slate-100 text-slate-700" };
  if (listing.sold || listing.stock <= 0) return { label: "Sold out", className: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "Live", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
}

/**
 * Accounts that started selling before College Mode have no college. They choose one once (it can't be
 * changed afterwards without an admin, so listings can't hop between campuses); it applies to new listings.
 */
function CollegeRequired({ onSaved }: { onSaved: (seller: SellerSummary) => void }) {
  const [choice, setChoice] = useState<College | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!choice || saving) return;
    if (!window.confirm(`List your products under ${choice.name}? You'll need to contact support to change it later.`)) return;
    setSaving(true);
    try {
      const { data } = await collegeService.setMySellerCollege(choice._id);
      toast.success(`Your listings now belong to ${choice.name}`);
      onSaved(data.seller);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Your college couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section aria-labelledby="college-required" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
        <div>
          <h2 id="college-required" className="font-semibold">Add your college to keep listing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New listings are shown to shoppers in your college's community. Your existing listings and orders are not affected.
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-white p-3">
        <CollegeList selectedId={choice?._id} onSelect={setChoice} listClassName="max-h-56" label="Search for your college" />
      </div>
      <Button className="mt-4" disabled={!choice || saving} onClick={() => void save()}>
        {saving ? "Saving…" : choice ? `Use ${choice.name}` : "Choose your college"}
      </Button>
    </section>
  );
}

function Dashboard({ seller, onSellerChange }: { seller: SellerSummary; onSellerChange: (seller: SellerSummary) => void }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (["listings", "new", "orders"].includes(params.get("tab") || "") ? params.get("tab") : "listings") as Tab;
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Listing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const userId = user?._id;

  const selectTab = (next: Tab) => {
    setEditing(null);
    setParams(next === "listings" ? {} : { tab: next }, { replace: true });
  };

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const [products, cats] = await Promise.all([productService.getProducts({ seller: userId, limit: 100 }), categoryService.getCategories()]);
      setListings(products.data.products ?? []);
      setCategories(cats.data.categories ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "We couldn't load your listings.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setPublished(listing: Listing, isActive: boolean) {
    if (!isActive && !window.confirm(`Hide “${listing.name}” from the store? Existing orders are not affected.`)) return;
    setBusy(listing._id);
    try {
      const { data } = await productService.updateProduct(listing._id, { isActive });
      setListings((current) => current.map((item) => (item._id === listing._id ? data.product : item)));
      toast.success(isActive ? "Listing is live again" : "Listing hidden from the store");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "The listing couldn't be updated.");
    } finally {
      setBusy(null);
    }
  }

  function saved(product: Listing, created: boolean) {
    setListings((current) => (created ? [product, ...current] : current.map((item) => (item._id === product._id ? product : item))));
    setEditing(null);
    setParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const live = listings.filter((item) => listingState(item).label === "Live").length;
  const soldOut = listings.filter((item) => listingState(item).label === "Sold out").length;
  const hidden = listings.filter((item) => item.isActive === false).length;
  const tabs: { id: Tab; label: string }[] = [
    { id: "listings", label: `Listings${listings.length ? ` (${listings.length})` : ""}` },
    { id: "new", label: "Add product" },
    { id: "orders", label: "Orders" },
  ];

  return (
    <SellerPageFrame
      wide
      title="Seller dashboard"
      description={
        <>
          {seller.campusEligible && seller.status !== "approved" ? "Your verified campus account can sell straight away." : "Manage your listings, stock and orders in one place."}
          {seller.college && (
            <span className="mt-1 flex items-center gap-1.5 text-sm">
              <GraduationCap className="h-4 w-4 text-primary" /> New listings appear in the <strong className="font-semibold text-foreground">{seller.college.name}</strong> community.
            </span>
          )}
        </>
      }
      actions={
        tab !== "new" && !seller.needsCollege && (
          <Button onClick={() => selectTab("new")}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        )
      }
    >
      {seller.needsCollege && <CollegeRequired onSaved={onSellerChange} />}

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {[
          ["Live", live],
          ["Sold out", soldOut],
          ["Hidden", hidden],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-white p-4">
            <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{loading ? "–" : value}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" aria-label="Seller dashboard sections" className="scrollbar-hide mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id && !editing}
            onClick={() => selectTab(id)}
            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors ${tab === id && !editing ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(editing || tab === "new") && seller.needsCollege && !editing ? (
        <p className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">Choose your college above to add new products.</p>
      ) : editing || tab === "new" ? (
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-7">
          <h2 className="mb-6 text-xl font-semibold">{editing ? `Edit “${editing.name}”` : "Add a new product"}</h2>
          {userId && (
            <ProductForm
              key={editing?._id || "new"}
              userId={userId}
              listing={editing}
              categories={categories}
              profile={seller.profile}
              onSaved={saved}
              onCancel={() => selectTab("listings")}
            />
          )}
        </section>
      ) : tab === "orders" ? (
        <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <SellerOrdersPage />
        </section>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error}
          <button onClick={() => void load()} className="ml-2 inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : loading ? (
        <div role="status" aria-label="Loading listings" className="space-y-3">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <PackageOpen className="mx-auto h-12 w-12 text-primary" strokeWidth={1.4} />
          <h2 className="mt-4 text-lg font-semibold">List your first product</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Add a few photos, set a price and it appears in the store right away.</p>
          {!seller.needsCollege && (
            <Button className="mt-6" onClick={() => selectTab("new")}>
              <Plus className="h-4 w-4" />
              Add product
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => {
            const state = listingState(listing);
            const categoryName = typeof listing.category === "object" ? listing.category?.name : "";
            return (
              <li key={listing._id} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 sm:flex-row sm:items-center sm:p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ProductImage src={listing.images?.[0]} alt={listing.name} className="h-16 w-16 shrink-0 rounded-xl bg-muted object-contain p-1" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{listing.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatCurrency(listing.price)} · {listing.stock} in stock{categoryName ? ` · ${categoryName}` : ""}
                    </p>
                    <span className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${state.className}`}>{state.label}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 sm:justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditing(listing)} aria-label={`Edit ${listing.name}`} className="flex-1 sm:flex-none">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  {listing.isActive === false ? (
                    <Button variant="outline" size="sm" disabled={busy === listing._id} onClick={() => void setPublished(listing, true)} className="flex-1 sm:flex-none">
                      <Eye className="h-4 w-4" />
                      Publish
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" disabled={busy === listing._id} onClick={() => void setPublished(listing, false)} aria-label={`Hide ${listing.name}`} className="flex-1 sm:flex-none">
                        <EyeOff className="h-4 w-4" />
                        Hide
                      </Button>
                      <Link to={`/products/${listing._id}`} aria-label={`View ${listing.name} in the store`} className={buttonClass("ghost", "sm", "w-11 shrink-0 px-0")}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SellerPageFrame>
  );
}

export default function SellerDashboard() {
  return <SellerGate path={SELL_PATHS.dashboard}>{({ seller, setSeller }) => <Dashboard seller={seller} onSellerChange={setSeller} />}</SellerGate>;
}
