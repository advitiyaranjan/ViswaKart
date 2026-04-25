import { Link } from "react-router";
import { ChevronRight, TrendingUp, Zap, ShieldCheck, Truck, RotateCcw, Headphones, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "../components/Button";
import { ProductCard } from "../components/ProductCard";
import { productService } from "../../services/productService";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { formatCurrency } from "../../lib/currency";

function seededDiscount(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return 14 + (Math.abs(h) % 67);
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  ratings: number;
  numReviews: number;
  category: { name: string };
  stock: number;
}

export default function Homepage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Subscribe state
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subMessage, setSubMessage] = useState("");

  useEffect(() => {
    setProductsLoading(true);
    Promise.all([
      // Show newest products in the hero area (new arrivals)
      productService.getProducts({ sort: "-createdAt", limit: 4 }),
      productService.getProducts({ sort: "-ratings", limit: 12 }),
    ])
      .then(([featuredRes, trendingRes]) => {
        const featured: Product[] = featuredRes.data.products;
        setFeaturedProducts(featured);
        const featuredIds = new Set(featured.map((p) => p._id));
        const unique = trendingRes.data.products.filter(
          (p: Product) => !featuredIds.has(p._id)
        );
        setTrendingProducts(unique.slice(0, 4));
      })
      .finally(() => setProductsLoading(false));
  }, []);

  // Listen for newly created products (optimistic update)
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<Product>;
      if (!ev?.detail) return;
      const prod = ev.detail;
      setFeaturedProducts((prev) => {
        const exists = prev.find((p) => p._id === prod._id);
        if (exists) return prev;
        return [prod, ...prev].slice(0, 4);
      });
      setTrendingProducts((prev) => {
        const exists = prev.find((p) => p._id === prod._id);
        if (exists) return prev;
        return [prod, ...prev].slice(0, 4);
      });
    };
    window.addEventListener('app:productCreated', handler as EventListener);
    return () => window.removeEventListener('app:productCreated', handler as EventListener);
  }, []);

  const handleSubscribe = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSubMessage("Please enter a valid email address.");
      setSubStatus("error");
      return;
    }
    setSubStatus("loading");
    setSubMessage("");
    try {
      await import("../../services/api").then(({ default: api }) =>
        api.post("/newsletter/subscribe", { email: trimmed })
      );
      setSubStatus("success");
      setSubMessage("You're subscribed! Check your inbox for a welcome email.");
      setEmail("");
    } catch {
      setSubStatus("error");
      setSubMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center py-10 md:py-14">
            {/* Left */}
            <div>
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-block bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-wider uppercase"
              >
                🔥 New arrivals · Free shipping over {formatCurrency(50)}
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-4xl md:text-5xl font-extrabold leading-tight mb-4"
              >
                Shop Smarter,<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  Live Better.
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-white/70 text-base md:text-lg mb-6 max-w-md"
              >
                Thousands of products across every category — delivered to your door with unbeatable prices.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-wrap gap-3"
              >
                <Link to="/products">
                  <Button size="lg" className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold shadow-lg shadow-amber-400/30">
                    Shop Now
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </Link>
                <Link to="/products?sort=-ratings">
                  <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                    Top Rated
                  </Button>
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 flex flex-wrap gap-4"
              >
                {[
                  { icon: Truck, label: "Free Delivery" },
                  { icon: RotateCcw, label: "Easy Returns" },
                  { icon: ShieldCheck, label: "Secure Payment" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-white/60 text-sm">
                    <Icon className="w-4 h-4 text-amber-400" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — product preview cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="hidden lg:grid grid-cols-2 gap-4"
            >
              {featuredProducts.slice(0, 4).map((product, i) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                >
                  <Link to={`/products/${product._id}`}>
                    <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:bg-white/15 transition-colors group">
                      <div className="aspect-video rounded-lg overflow-hidden bg-white/5 mb-2 relative">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.png"; }}
                        />
        <span className="absolute top-1.5 left-1.5 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          {seededDiscount(product._id)}% off
                        </span>
                      </div>
                      <p className="text-white text-xs font-semibold truncate">{product.name}</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-amber-400 text-sm font-bold">{formatCurrency(product.price)}</p>
                          <p className="text-white/40 text-xs line-through">{formatCurrency(product.price / (1 - seededDiscount(product._id) / 100))}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Value Props Bar */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm font-medium">
            {[
              { icon: Truck, text: `Free Shipping ${formatCurrency(50)}+` },
              { icon: RotateCcw, text: "30-Day Returns" },
              { icon: ShieldCheck, text: "Secure Checkout" },
              { icon: Headphones, text: "24/7 Support" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center justify-center gap-2">
                <Icon className="w-4 h-4 opacity-80" />
                <span className="opacity-90">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="text-2xl font-bold">Featured Products</h2>
            </div>
            <p className="text-muted-foreground text-sm">Handpicked items just for you</p>
          </div>
          <Link to="/products">
            <Button variant="ghost" size="md">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {productsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border bg-slate-100 animate-pulse">
                  <div className="aspect-square bg-slate-200 rounded-t-xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-5 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              ))
            : featuredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  id={product._id}
                  name={product.name}
                  price={product.price}
                  image={product.images[0]}
                  rating={product.ratings}
                  reviews={product.numReviews}
                  category={product.category?.name}
                  stock={product.stock}
                />
              ))}
        </div>
      </section>

      {/* Trending Products */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-rose-500" />
                <h2 className="text-2xl font-bold">Trending Now</h2>
              </div>
              <p className="text-muted-foreground text-sm">Highest rated by our customers</p>
            </div>
            <Link to="/products?sort=-ratings">
              <Button variant="ghost" size="md">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-white animate-pulse">
                    <div className="aspect-square bg-slate-200 rounded-t-xl" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                      <div className="h-5 bg-slate-200 rounded w-1/3" />
                    </div>
                  </div>
                ))
              : trendingProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    id={product._id}
                    name={product.name}
                    price={product.price}
                    image={product.images[0]}
                    rating={product.ratings}
                    reviews={product.numReviews}
                    category={product.category?.name}
                    stock={product.stock}
                  />
                ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="relative overflow-hidden bg-slate-900 rounded-2xl p-8 md:p-12 text-white text-center">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Get Exclusive Deals</h2>
              <p className="text-slate-400 mb-6 max-w-xl mx-auto">
              Join 50,000+ shoppers. Get early access to sales and new arrivals.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSubStatus("idle"); setSubMessage(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                placeholder="Enter your email"
                disabled={subStatus === "loading" || subStatus === "success"}
                className="flex-1 px-4 py-3 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white border-2 border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-60"
              />
              <Button
                size="lg"
                className="bg-white hover:bg-slate-100 text-slate-900 font-bold whitespace-nowrap disabled:opacity-60"
                onClick={handleSubscribe}
                disabled={subStatus === "loading" || subStatus === "success"}
              >
                {subStatus === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : subStatus === "success" ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                ) : null}
                {subStatus === "success" ? "Subscribed!" : "Subscribe"}
              </Button>
            </div>
            {subMessage && (
              <p className={`mt-3 text-sm font-medium ${subStatus === "success" ? "text-green-400" : "text-red-400"}`}>
                {subMessage}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
