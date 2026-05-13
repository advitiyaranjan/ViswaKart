import { useState, useEffect, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { SlidersHorizontal, X, ChevronRight } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { CatalogCategory, CatalogProduct, CatalogGrid, CatalogMessage, CatalogPagination } from "../components/CatalogUI";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { productService, categoryService } from "../../services/productService";
import { formatCurrency } from "../../lib/currency";

const SORTS = [
  { value: "-createdAt", label: "Newest arrivals" },
  { value: "price", label: "Price: low to high" },
  { value: "-price", label: "Price: high to low" },
  { value: "-ratings", label: "Highest rated" },
];
const PAGE_SIZE = 12;

function validNumber(value: string | null) {
  return value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
}

interface FilterChip {
  text: string;
  clear: Record<string, string>;
}

export default function ProductListing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "";
  const sort = SORTS.some((option) => option.value === searchParams.get("sort")) ? searchParams.get("sort")! : "-createdAt";
  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const minPrice = validNumber(searchParams.get("minPrice"));
  const maxPrice = validNumber(searchParams.get("maxPrice"));
  const minRating = Math.min(5, validNumber(searchParams.get("minRating")) || 0);
  const inStock = searchParams.get("inStock") === "true";

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [minDraft, setMinDraft] = useState(minPrice?.toString() || "");
  const [maxDraft, setMaxDraft] = useState(maxPrice?.toString() || "");
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    setMinDraft(minPrice?.toString() || "");
    setMaxDraft(maxPrice?.toString() || "");
    setPriceError("");
  }, [minPrice, maxPrice]);

  useEffect(() => {
    let current = true;
    categoryService
      .getCategories()
      .then((res) => current && setCategories(res.data.categories ?? []))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const query = {
      page,
      limit: PAGE_SIZE,
      category: category || undefined,
      minPrice,
      maxPrice,
      sort,
      minRating: minRating || undefined,
      inStock: inStock || undefined,
    };
    productService
      .getProducts(query)
      .then((res) => {
        if (!current) return;
        setProducts(res.data.products ?? []);
        setTotal(res.data.total ?? 0);
        setPages(Math.max(1, res.data.pages ?? 1));
      })
      .catch(() => current && setError("We couldn't load these products. Please check your connection and try again."))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [page, category, minPrice, maxPrice, sort, minRating, inStock, refresh]);

  function update(values: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams);
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    setSearchParams(params);
  }

  function clearAll() {
    setSearchParams(sort !== "-createdAt" ? { sort } : {});
  }

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    const min = validNumber(minDraft);
    const max = validNumber(maxDraft);
    if ((minDraft && min === undefined) || (maxDraft && max === undefined) || (min !== undefined && max !== undefined && min > max)) {
      setPriceError("Enter a valid range with the maximum above the minimum.");
      return;
    }
    setPriceError("");
    update({ minPrice: minDraft, maxPrice: maxDraft });
  }

  const categoryName = categories.find((item) => item.slug === category || item._id === category)?.name;
  const chips: FilterChip[] = [];
  if (category) chips.push({ text: categoryName || "Selected category", clear: { category: "" } });
  if (minPrice !== undefined || maxPrice !== undefined) {
    chips.push({
      text: `${formatCurrency(minPrice ?? 0)} – ${maxPrice !== undefined ? formatCurrency(maxPrice) : "Any"}`,
      clear: { minPrice: "", maxPrice: "" },
    });
  }
  if (minRating) chips.push({ text: `${minRating}+ stars`, clear: { minRating: "" } });
  if (inStock) chips.push({ text: "In stock", clear: { inStock: "" } });
  const activeCount = chips.length;

  const filterPanel = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Category</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="radio"
            name="category"
            checked={!category}
            onChange={() => update({ category: "" })}
            className="h-4 w-4 accent-primary"
          />
          All products
        </label>
        {categories.map((item) => (
          <label key={item._id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name="category"
              checked={category === item.slug}
              onChange={() => update({ category: item.slug })}
              className="h-4 w-4 accent-primary"
            />
            <span>{item.name}</span>
            {item.productCount !== undefined && <span className="ml-auto text-xs text-muted-foreground">{item.productCount}</span>}
          </label>
        ))}
      </fieldset>

      <form onSubmit={applyPrice} className="border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-semibold">Price range (₹)</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Minimum"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={minDraft}
            onChange={(event) => setMinDraft(event.target.value)}
            className="px-3"
          />
          <Input
            label="Maximum"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Any"
            value={maxDraft}
            onChange={(event) => setMaxDraft(event.target.value)}
            className="px-3"
          />
        </div>
        {priceError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {priceError}
          </p>
        )}
        <Button type="submit" variant="outline" className="mt-3 w-full">
          Apply price
        </Button>
      </form>

      <fieldset className="border-t border-border pt-5">
        <legend className="text-sm font-semibold">Customer rating</legend>
        {[0, 4, 3, 2].map((rating) => (
          <label key={rating} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name="rating"
              checked={minRating === rating}
              onChange={() => update({ minRating: rating ? String(rating) : "" })}
              className="h-4 w-4 accent-primary"
            />
            {rating ? `${rating} stars & up` : "Any rating"}
          </label>
        ))}
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border pt-4 text-sm">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(event) => update({ inStock: event.target.checked ? "true" : "" })}
          className="h-4 w-4 accent-primary"
        />
        In stock only
      </label>
    </div>
  );

  const summary = loading
    ? "Finding your products…"
    : error
      ? "Your collection will appear here."
      : `${total} ${total === 1 ? "product" : "products"}${activeCount ? " matching your filters" : " to discover"}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span aria-current="page">Shop</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Find your next favourite</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{categoryName || "Explore the collection"}</h1>
          <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
            {summary}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
          <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters(true)} aria-haspopup="dialog">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">{activeCount}</span>
            )}
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="product-sort" className="hidden text-sm text-muted-foreground sm:block">
              Sort by
            </label>
            <select
              id="product-sort"
              value={sort}
              onChange={(event) => update({ sort: event.target.value })}
              className="min-h-11 min-w-0 max-w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside aria-label="Product filters" className="hidden shrink-0 lg:block lg:w-60">
          <div className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-white p-5">
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </h2>
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="min-h-11 text-xs font-semibold text-primary">
                  Clear all
                </button>
              )}
            </div>
            {filterPanel}
          </div>
        </aside>

        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="left" className="w-[min(88vw,340px)] gap-0 overflow-y-auto bg-white p-0">
            <div className="sticky top-0 z-10 border-b border-border bg-white px-5 py-4 pr-14">
              <SheetTitle className="text-lg">Filters</SheetTitle>
              <SheetDescription>{summary}</SheetDescription>
            </div>
            <div className="px-5 py-4">{filterPanel}</div>
            <div className="safe-bottom sticky bottom-0 mt-auto flex gap-3 border-t border-border bg-white px-5 pt-3">
              {activeCount > 0 && (
                <Button variant="outline" className="flex-1" onClick={clearAll}>
                  Clear all
                </Button>
              )}
              <Button className="flex-1" onClick={() => setShowFilters(false)}>
                Show {loading ? "" : total} {total === 1 ? "product" : "products"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          {activeCount > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.text}
                  type="button"
                  onClick={() => update(chip.clear)}
                  aria-label={`Remove filter: ${chip.text}`}
                  className="flex min-h-10 items-center gap-2 rounded-full border border-primary/15 bg-accent/50 px-3 text-xs font-medium text-primary"
                >
                  {chip.text}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
          {error ? (
            <CatalogMessage error title="Products couldn't load" message={error} onAction={() => setRefresh((value) => value + 1)} />
          ) : !loading && products.length === 0 ? (
            <CatalogMessage
              title={page > 1 ? "You've reached the end" : "No matches this time"}
              message={
                page > 1 ? "Return to the first page to see the available products." : "Try a different category or a wider price range."
              }
              action={page > 1 ? "Back to first page" : "Clear filters"}
              onAction={() => (page > 1 ? goToPage(1) : clearAll())}
            />
          ) : (
            <CatalogGrid products={products} loading={loading} columns={3} skeletons={6} />
          )}
          {!loading && !error && <CatalogPagination page={page} pages={pages} onChange={goToPage} />}
        </div>
      </div>
    </div>
  );
}
