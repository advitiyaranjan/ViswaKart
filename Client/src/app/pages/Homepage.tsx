import { Link } from "react-router";
import { ArrowRight, ArrowUpRight, Sparkles, Heart, Search, ShoppingBag, Grid3X3, Loader2, Check, Store, Camera, BadgeIndianRupee } from "lucide-react";
import { useState, useEffect, FormEvent } from "react";
import { Button } from "../components/Button";
import { CatalogCategory, CatalogProduct, CatalogGrid, CatalogMessage } from "../components/CatalogUI";
import { ProductImage } from "../components/ProductImage";
import { productService, categoryService } from "../../services/productService";
import { formatCurrency } from "../../lib/currency";
import api from "../../services/api";
import { CollegeEmptyState, CollegeModeToggle } from "../components/college/CollegeMode";
import { useCollegeMode } from "../../context/CollegeModeContext";

export default function Homepage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subMessage, setSubMessage] = useState("");
  const { collegeFilter, ready, college, markUnavailable } = useCollegeMode();

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    // Wait for the saved College Mode preference so the wrong catalogue never flashes first.
    if (!ready) return;
    productService
      .getProducts({ sort: "-createdAt", limit: 8, college: collegeFilter })
      .then((res) => {
        if (current) setProducts(res.data.products ?? []);
      })
      .catch((err) => {
        if (!current) return;
        if (collegeFilter && err?.response?.status === 404) markUnavailable();
        else setError("We couldn't load the collection. Please try again.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    categoryService
      .getCategories()
      .then((res) => {
        if (current) setCategories(res.data.categories ?? []);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [refresh, collegeFilter, ready, markUnavailable]);

  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    window.addEventListener("app:productCreated", reload);
    return () => window.removeEventListener("app:productCreated", reload);
  }, []);

  async function subscribe(event: FormEvent) {
    event.preventDefault();
    if (subStatus === "loading") return;
    setSubStatus("loading");
    setSubMessage("");
    try {
      await api.post("/newsletter/subscribe", { email: email.trim() });
      setSubStatus("success");
      setSubMessage("You're on the list. Thanks for subscribing!");
      setEmail("");
    } catch {
      setSubStatus("error");
      setSubMessage("We couldn't subscribe you right now. Please try again.");
    }
  }

  const heroProduct = products[0];
  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
        <div className="store-hero relative overflow-hidden rounded-[1.75rem] bg-[#e5eeea]">
          <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:p-14">
            <div className="relative z-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />A little discovery. Every day.
              </div>
              <h1 className="max-w-xl text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#173b35] sm:text-5xl lg:text-[3.75rem]">
                Good finds.
                <br />
                Great everyday<span className="text-primary">.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-[#526e66]">
                From daily essentials to your next favourite thing. Find what fits your life, all in one place.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/products"
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#173b35] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary"
                >
                  Explore the collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/sell"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#173b35]/20 bg-white/70 px-6 text-sm font-semibold text-[#173b35] transition-colors hover:border-primary/40 hover:bg-white"
                >
                  <Store className="h-4 w-4" />
                  Sell your product
                </Link>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-[#526e66]">
                <Heart className="h-4 w-4" />
                Find it. Love it. Make it yours.
              </div>
            </div>
            <div className="relative">
              {heroProduct ? (
                <Link
                  to={`/products/${heroProduct._id}`}
                  className="group relative block overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_16px_60px_-24px_rgba(20,60,50,0.3)] sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Fresh in the collection</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="relative aspect-[16/10] rounded-xl bg-[#f5f7f5] p-5 sm:aspect-[4/3]">
                    <ProductImage
                      src={heroProduct.images?.[0]}
                      alt={heroProduct.name}
                      fetchPriority="high"
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {heroProduct.category?.name || "New arrival"}
                      </p>
                      <p className="truncate text-sm font-semibold">{heroProduct.name}</p>
                    </div>
                    <p className="shrink-0 text-base font-semibold text-primary">{formatCurrency(heroProduct.price)}</p>
                  </div>
                </Link>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-white/80 bg-white/35 p-8 text-primary">
                  <ShoppingBag className="mb-5 h-20 w-20" strokeWidth={1} />
                  <p className="text-lg font-medium">Your next find starts here</p>
                  <p className="mt-2 text-sm text-[#526e66]">A collection made for browsing.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <CollegeModeToggle />

      <section
        aria-label="Shopping made simple"
        className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-8 lg:py-8"
      >
        {[
          { icon: Search, title: "Find your kind of thing", text: "Search and filter your way." },
          { icon: Heart, title: "Save it for later", text: "Keep favourites in your wishlist." },
          { icon: ShoppingBag, title: "Make it an easy everyday", text: "Shop from wherever you are." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 rounded-xl border border-border/70 bg-white px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf5f0] text-primary">
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-9 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Shop by category</h2>
            <Link to="/products" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
              Shop all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {categories.map((category) => (
              <Link
                key={category._id}
                to={`/products?category=${encodeURIComponent(category.slug)}`}
                className="flex min-h-14 shrink-0 items-center gap-3 rounded-xl border border-border bg-white py-3 pl-3 pr-5 text-sm font-medium hover:border-primary/40 hover:bg-accent/30"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-primary">
                  <Grid3X3 className="h-4 w-4" />
                </span>
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{collegeFilter ? "Just landed on campus" : "Just landed"}</p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meet your new favourites</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {collegeFilter && college ? `The latest from sellers at ${college.name}.` : "The latest additions to explore."}
            </p>
          </div>
          <Link to="/products?sort=-createdAt" className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            <span className="hidden sm:inline">View all</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
        {error ? (
          <CatalogMessage
            error
            title="The collection is taking a moment"
            message={error}
            onAction={() => setRefresh((value) => value + 1)}
          />
        ) : !loading && !products.length && collegeFilter ? (
          <CollegeEmptyState />
        ) : !loading && !products.length ? (
          <CatalogMessage
            title="Something good is on its way"
            message="There are no products to display yet. Check back for new arrivals."
          />
        ) : (
          <CatalogGrid loading={loading} products={products.slice(0, 4)} />
        )}
      </section>

      {products.length > 4 && (
        <section className="border-y border-border bg-[#edf2ef] py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Keep discovering</p>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">More to make your own</h2>
              </div>
              <Link to="/products" aria-label="Explore all products" className="header-action border border-primary/20 text-primary">
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <CatalogGrid products={products.slice(4, 8)} />
          </div>
        </section>
      )}

      <SellBanner />

      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="grid gap-7 rounded-[1.5rem] bg-[#183e37] p-6 text-white sm:p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b2d9c6]">The occasional good thing</p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">A fresh find in your inbox.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              Sign up for product updates and new arrivals from ViswaKart.
            </p>
          </div>
          <form onSubmit={subscribe}>
            <label htmlFor="newsletter-email" className="mb-2 block text-sm text-white/90">
              Your email address
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="newsletter-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSubStatus("idle");
                  setSubMessage("");
                }}
                disabled={subStatus === "loading" || subStatus === "success"}
                placeholder="you@example.com"
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#b2d9c6]"
              />
              <Button
                type="submit"
                size="lg"
                disabled={subStatus === "loading" || subStatus === "success"}
                className="bg-[#d5eadc] text-[#183e37] hover:bg-white"
              >
                {subStatus === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : subStatus === "success" ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {subStatus === "success" ? "Subscribed" : "Keep me updated"}
              </Button>
            </div>
            <p aria-live="polite" className="mt-3 text-xs text-white/80">
              {subMessage || "Only updates you signed up for."}
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

/** Seller recruitment card. /sell routes each visitor (signed out, applicant, seller) to the right step. */
function SellBanner() {
  return (
    <section aria-labelledby="sell-banner-title" className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
      <div className="group relative overflow-hidden rounded-[1.5rem] border border-[#cfe0d8] bg-gradient-to-br from-white to-[#edf5f0] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5 transition-transform duration-700 group-hover:scale-110" aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Store className="h-6 w-6" strokeWidth={1.7} />
            </span>
            <h2 id="sell-banner-title" className="text-2xl font-semibold tracking-tight text-[#173b35] sm:text-3xl">
              Have something to sell?
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#526e66] sm:text-base">
              Join our seller community, showcase your products, and reach more customers.
            </p>
            <Link
              to="/sell"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#173b35]"
            >
              Start selling
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: Camera, title: "List in minutes", text: "Add photos, a price and a short description." },
              { icon: BadgeIndianRupee, title: "Set your own price", text: "You decide what it's worth and how many to sell." },
              { icon: ShoppingBag, title: "Manage orders easily", text: "Track every order from your seller dashboard." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-xl border border-white bg-white/80 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf5f0] text-primary">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
