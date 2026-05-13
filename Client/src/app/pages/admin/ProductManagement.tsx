import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { Plus, Search, Pencil, Trash2, ArrowUpRight, Package, RotateCcw, Link2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "../../components/Button";
import { ProductImage } from "../../components/ProductImage";
import ImageUploader from "../../components/ImageUploader";
import { productService, categoryService } from "../../../services/productService";
import { formatCurrency } from "../../../lib/currency";
import { availableStock, getProductPricing } from "../../../lib/commerce";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { PageHeading, ErrorNotice, EmptyState, Pagination, inputClass, panelClass, actionClass, errorMessage } from "./AdminUI";

interface Category {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  category: Category | null;
  price: number;
  originalPrice?: number;
  stock: number;
  sold?: boolean;
  isActive?: boolean;
  ratings?: number;
  numReviews?: number;
  images?: string[];
  description: string;
  sellerEmail?: string;
}

interface ProductForm {
  name: string;
  category: string;
  price: string;
  originalPrice: string;
  stock: string;
  description: string;
  images: string[];
}

const emptyForm: ProductForm = { name: "", category: "", price: "", originalPrice: "", stock: "", description: "", images: [] };
const PAGE_SIZE = 20;
// Must match the server's image URL rule in productController.
const IMAGE_URL = /^(https?:\/\/|\/uploads\/)/i;

function Thumb({ product }: { product: Product }) {
  return (
    <ProductImage
      src={product.images?.[0]}
      alt=""
      className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-slate-50 object-contain p-0.5"
    />
  );
}

function StockBadge({ product }: { product: Product }) {
  if (product.isActive === false)
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Removed
      </span>
    );
  const stock = availableStock(product);
  const tone = stock > 5 ? "bg-teal-50 text-teal-700" : stock > 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {stock > 0 ? `${stock} in stock` : "Sold out"}
    </span>
  );
}

function Price({ product }: { product: Product }) {
  const pricing = getProductPricing(product);
  return (
    <>
      <span className="font-semibold">{formatCurrency(pricing.price)}</span>
      {pricing.discount > 0 && (
        <span className="ml-2 text-xs text-slate-400">
          <s>{formatCurrency(pricing.originalPrice)}</s> · {pricing.discount}% off
        </span>
      )}
    </>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageUrl, setImageUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadProducts = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError("");
    try {
      const { data } = await productService.getProducts({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        category: category || undefined,
        includeInactive: showRemoved || undefined,
      });
      if (id !== requestId.current) return;
      setProducts(data.products || []);
      setTotal(data.total ?? 0);
      if (page > 1 && data.products?.length === 0) setPage(page - 1);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err, "We couldn't load the product catalog."));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [page, search, category, showRemoved]);

  useEffect(() => {
    const timer = setTimeout(() => void loadProducts(), 250);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [loadProducts]);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await categoryService.getCategories();
      setCategories(data.categories || []);
    } catch (err) {
      toast.error(errorMessage(err, "Categories could not be loaded. Please refresh before editing a product."));
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function openEditor(product?: Product) {
    setEditing(product || null);
    setForm(
      product
        ? {
            name: product.name,
            category: product.category?._id || "",
            price: String(product.price),
            originalPrice: product.originalPrice && product.originalPrice > product.price ? String(product.originalPrice) : "",
            stock: String(product.stock),
            description: product.description,
            images: product.images || [],
          }
        : emptyForm,
    );
    setImageUrl("");
    setFormError("");
    setShowModal(true);
    void loadCategories();
  }

  async function removeProduct(product: Product) {
    if (
      !window.confirm(`Remove “${product.name}” from the store? Existing orders keep their product details, and you can restore it later.`)
    )
      return;
    setBusyId(product._id);
    try {
      await productService.deleteProduct(product._id);
      await loadProducts();
      toast.success("Product removed from the store");
    } catch (err) {
      toast.error(errorMessage(err, "The product could not be removed."));
    } finally {
      setBusyId(null);
    }
  }

  async function restoreProduct(product: Product) {
    setBusyId(product._id);
    try {
      await productService.updateProduct(product._id, { isActive: true });
      await loadProducts();
      toast.success("Product is back in the store");
    } catch (err) {
      toast.error(errorMessage(err, "The product could not be restored."));
    } finally {
      setBusyId(null);
    }
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    if (!IMAGE_URL.test(url)) {
      setFormError("Image links must start with http:// or https://.");
      return;
    }
    setForm((current) => ({ ...current, images: [...current.images, url].slice(0, 12) }));
    setImageUrl("");
    setFormError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const price = Number(form.price);
    const originalPrice = form.originalPrice.trim() ? Number(form.originalPrice) : price;
    const stock = Number(form.stock);
    if (!form.name.trim() || !form.description.trim()) return setFormError("Enter a product name and description.");
    if (!form.category) return setFormError("Choose a category.");
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(originalPrice) || originalPrice < price) {
      return setFormError("Selling price must be positive, and the compare-at price can't be lower than it.");
    }
    if (!Number.isInteger(stock) || stock < 0) return setFormError("Stock must be a whole number of zero or more.");
    if (form.images.some((value) => !IMAGE_URL.test(value)))
      return setFormError("One of the images has an invalid link. Remove it and try again.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        price,
        originalPrice,
        stock,
        description: form.description.trim(),
        images: form.images,
      };
      if (editing) await productService.updateProduct(editing._id, payload);
      else await productService.createProduct(payload);
      setShowModal(false);
      await loadProducts();
      toast.success(editing ? "Product updated" : "Product added");
    } catch (err) {
      setFormError(errorMessage(err, "The product could not be saved. Your changes are still here."));
    } finally {
      setSaving(false);
    }
  }

  const actions = (product: Product) => (
    <div className="flex items-center gap-1">
      {product.isActive === false ? (
        <button
          aria-label={`Restore ${product.name}`}
          title="Restore to store"
          disabled={busyId === product._id}
          className={actionClass}
          onClick={() => void restoreProduct(product)}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      ) : (
        <Link aria-label={`View ${product.name} in the store`} to={`/products/${product._id}`} className={actionClass}>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
      <button aria-label={`Edit ${product.name}`} className={actionClass} onClick={() => openEditor(product)}>
        <Pencil className="h-4 w-4" />
      </button>
      {product.isActive !== false && (
        <button
          aria-label={`Remove ${product.name}`}
          disabled={busyId === product._id}
          className={`${actionClass} hover:!bg-red-50 hover:!text-red-600`}
          onClick={() => void removeProduct(product)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const field = (key: Exclude<keyof ProductForm, "images">) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  const preview =
    Number(form.price) > 0
      ? getProductPricing({ price: Number(form.price), originalPrice: Number(form.originalPrice) || Number(form.price) })
      : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Products"
        description="A well-kept catalog makes shopping easier. Manage availability, details and the price customers pay."
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        }
      />

      <div className={`${panelClass} flex flex-col gap-3 p-4 md:flex-row md:items-center`}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            aria-label="Search products"
            type="search"
            placeholder="Search your catalog"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          className={`${inputClass} md:max-w-52`}
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item._id} value={item._id}>
              {item.name}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showRemoved}
            onChange={(event) => {
              setShowRemoved(event.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-teal-600"
          />
          Include removed
        </label>
      </div>

      {error && <ErrorNotice message={error} retry={loadProducts} />}

      <section className={`${panelClass} overflow-hidden`}>
        {isLoading ? (
          <EmptyState loading />
        ) : error ? null : products.length === 0 ? (
          <EmptyState
            title="No products found"
            description={
              search || category
                ? "Try another search or choose a different category."
                : "Add your first product to start building your catalog."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 xl:hidden">
              {products.map((product) => (
                <li key={product._id} className={`p-4 ${product.isActive === false ? "bg-slate-50/70" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Thumb product={product} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.category?.name || "Category unavailable"}</p>
                      <p className="mt-2 text-sm">
                        <Price product={product} />
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <StockBadge product={product} />
                    {actions(product)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {["Product", "Selling price", "Inventory", "Rating", "Actions"].map((heading) => (
                      <th key={heading} className="px-5 py-4 text-left font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product._id} className={product.isActive === false ? "bg-slate-50/70" : "hover:bg-slate-50/50"}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Thumb product={product} />
                          <div className="max-w-72">
                            <p className="font-semibold">{product.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {product.category?.name || "Category unavailable"}
                              {product.sellerEmail && ` · ${product.sellerEmail}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Price product={product} />
                      </td>
                      <td className="px-5 py-4">
                        <StockBadge product={product} />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {product.numReviews ? `${Number(product.ratings || 0).toFixed(1)} / 5` : "No reviews"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{product.numReviews || 0} reviews</p>
                      </td>
                      <td className="px-5 py-4">{actions(product)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!error && <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} loading={isLoading} />}
      </section>

      <Dialog open={showModal} onOpenChange={(open) => !saving && !uploading && setShowModal(open)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl bg-white sm:max-w-2xl">
          <DialogTitle className="pr-8 text-xl">{editing ? "Edit product" : "Add a product"}</DialogTitle>
          <DialogDescription>Clear details and accurate inventory help customers shop with confidence.</DialogDescription>
          <form onSubmit={save} className="space-y-5" noValidate>
            {formError && <ErrorNotice message={formError} />}
            <div>
              <label htmlFor="product-name" className="mb-2 block text-sm font-medium">
                Product name
              </label>
              <input id="product-name" required minLength={2} maxLength={200} className={inputClass} {...field("name")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product-category" className="mb-2 block text-sm font-medium">
                  Category
                </label>
                <select id="product-category" required className={inputClass} {...field("category")}>
                  <option value="">Choose a category</option>
                  {categories.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && <p className="mt-2 text-xs text-amber-700">Create a category before adding products.</p>}
              </div>
              <div>
                <label htmlFor="product-stock" className="mb-2 block text-sm font-medium">
                  Stock available
                </label>
                <input
                  id="product-stock"
                  required
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100000}
                  step={1}
                  className={inputClass}
                  {...field("stock")}
                />
              </div>
              <div>
                <label htmlFor="product-price" className="mb-2 block text-sm font-medium">
                  Selling price (₹)
                </label>
                <input
                  id="product-price"
                  required
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={1000000}
                  step={0.01}
                  className={inputClass}
                  {...field("price")}
                />
                <p className="mt-2 text-xs text-slate-500">The final price your customer pays.</p>
              </div>
              <div>
                <label htmlFor="product-original-price" className="mb-2 block text-sm font-medium">
                  Compare-at price (₹) <span className="font-normal text-slate-400">optional</span>
                </label>
                <input
                  id="product-original-price"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={1000000}
                  step={0.01}
                  className={inputClass}
                  {...field("originalPrice")}
                />
                <p className="mt-2 text-xs text-slate-500">
                  {preview && preview.discount > 0 ? `Shown as ${preview.discount}% off.` : "A higher original price shows the savings."}
                </p>
              </div>
            </div>
            <div>
              <label htmlFor="product-description" className="mb-2 block text-sm font-medium">
                Description
              </label>
              <textarea
                id="product-description"
                required
                minLength={10}
                rows={4}
                className={`${inputClass} resize-y`}
                {...field("description")}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Photos</p>
              <ImageUploader
                images={form.images}
                onChange={(images: string[]) => setForm((current) => ({ ...current, images }))}
                max={12}
                onUploadingChange={setUploading}
              />
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    aria-label="Image link"
                    type="url"
                    inputMode="url"
                    placeholder="Or paste an image link (https://…)"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addImageUrl();
                      }
                    }}
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <Button type="button" variant="outline" onClick={addImageUrl} disabled={!imageUrl.trim()}>
                  Add
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">The first photo is the cover.</p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={saving} onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploading || categories.length === 0}>
                <Package className="h-4 w-4" />
                {saving ? "Saving…" : uploading ? "Uploading…" : editing ? "Save changes" : "Add product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
