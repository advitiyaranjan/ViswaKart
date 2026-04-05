import { useParams, Link, useNavigate } from "react-router";
import { Star, ShoppingCart, Check, Heart, Share2, Truck, Shield, RotateCcw, ThumbsUp, AlertCircle, Zap, MapPin, CheckCircle2, Search, ChevronDown, ChevronUp, Package, Link2 } from "lucide-react";
import { Button } from "../components/Button";
import { ProductCard } from "../components/ProductCard";
import { productService } from "../../services/productService";
import { useCart } from "../../context/CartContext";
import { useState, useEffect } from "react";

// ── Seeded rating: 80% of products 4.0–5.0, 15% 3.0–3.9, 5% 2.0–2.9 ──────
function seededRating(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  const r = Math.abs(h) % 100;
  if (r < 5)  return parseFloat((2 + (r * 0.18)).toFixed(1));
  if (r < 20) return parseFloat((3 + ((r - 5) / 15) * 0.9).toFixed(1));
  return parseFloat((4 + ((r - 20) / 80)).toFixed(1));
}

function seededNumReviews(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i) * 7) | 0;
  return 12 + (Math.abs(h) % 489);
}

// ── Seeded discount (reuse same logic as Cart) ────────────────────────────────
function seededDiscount(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return 14 + (Math.abs(h) % 67);
}

function getMRP(price: number, id: string) {
  return price / (1 - seededDiscount(id) / 100);
}

// ── Pincode deliverability ────────────────────────────────────────────────────
function checkPinDeliverability(pin: string): "deliverable" | "not-deliverable" | "invalid" {
  if (!/^\d{5,6}$/.test(pin.trim())) return "invalid";
  const n = parseInt(pin.trim());
  const bad = (n % 17 === 0 && parseInt(pin[0]) >= 6) || (n % 23 === 0 && parseInt(pin[0]) >= 8);
  return bad ? "not-deliverable" : "deliverable";
}

// ── Product specifications (seeded by category) ───────────────────────────────
function getSpecs(product: Product): Record<string, string> {
  const catName = product.category?.name?.toLowerCase() ?? "";
  const discPct = seededDiscount(product._id);

  // Build a hash number for variety
  let h = 0;
  for (let i = 0; i < product._id.length; i++) h = (Math.imul(31, h) + product._id.charCodeAt(i)) | 0;
  const n = Math.abs(h);

  const brands = ["Nexura", "TerraFlex", "VaultX", "Luminos", "CraftCore", "ZenBrand", "ProLine", "Elevate"];
  const brand = brands[n % brands.length];
  const weights = ["0.3 kg", "0.5 kg", "0.8 kg", "1.2 kg", "1.8 kg", "2.5 kg"];
  const weight = weights[n % weights.length];
  const warranties = ["6 Months", "1 Year", "2 Years", "3 Years"];
  const warranty = warranties[n % warranties.length];
  const colors = ["Midnight Black", "Pearl White", "Slate Grey", "Forest Green", "Ocean Blue", "Cream", "Charcoal"];
  const color = colors[n % colors.length];
  const materials = ["Premium ABS", "Stainless Steel", "High-grade Aluminium", "BPA-free Plastic", "Natural Wood", "Reinforced Nylon"];
  const material = materials[n % materials.length];

  const base: Record<string, string> = {
    Brand: brand,
    SKU: `${brand.slice(0, 3).toUpperCase()}-${(n % 9000 + 1000)}`,
    Color: color,
    Material: material,
    Weight: weight,
    Warranty: warranty,
    "Discount on MRP": `${discPct}%`,
    "Country of Origin": ["USA", "India", "Germany", "Japan", "UK"][n % 5],
  };

  // Category-specific specs
  if (catName.includes("electronic") || catName.includes("tech") || catName.includes("phone") || catName.includes("gadget")) {
    Object.assign(base, {
      "Battery Life": `${(n % 24) + 8} hours`,
      Connectivity: ["Bluetooth 5.0", "WiFi 6", "USB-C", "Wireless"][n % 4],
      "Water Resistance": ["IP67", "IP68", "IPX4", "None"][n % 4],
      Voltage: "110–240V",
    });
  } else if (catName.includes("cloth") || catName.includes("fashion") || catName.includes("wear") || catName.includes("apparel")) {
    Object.assign(base, {
      Size: ["XS", "S", "M", "L", "XL", "XXL"][(n % 4) + 1],
      Fit: ["Regular", "Slim Fit", "Relaxed Fit", "Oversized"][n % 4],
      "Care Instructions": "Machine wash cold",
      Fabric: ["100% Cotton", "Polyester blend", "Linen", "Merino Wool"][n % 4],
    });
  } else if (catName.includes("home") || catName.includes("kitchen") || catName.includes("decor") || catName.includes("furniture")) {
    Object.assign(base, {
      Dimensions: `${(n % 40) + 10} × ${(n % 30) + 10} × ${(n % 25) + 5} cm`,
      Capacity: [`${(n % 4) + 1}L`, `${(n % 8) + 2} pcs`][n % 2],
      "Assembly Required": n % 3 === 0 ? "Yes" : "No",
      "Indoor/Outdoor": n % 2 === 0 ? "Indoor" : "Indoor & Outdoor",
    });
  } else if (catName.includes("sport") || catName.includes("fitness") || catName.includes("outdoor")) {
    Object.assign(base, {
      "Skill Level": ["Beginner", "Intermediate", "Advanced"][n % 3],
      "Age Group": "Adults (16+)",
      "Pack Size": `Set of ${(n % 4) + 1}`,
      Certification: ["ISO 9001", "CE Certified", "FDA Approved"][n % 3],
    });
  } else if (catName.includes("book") || catName.includes("stationery") || catName.includes("office")) {
    Object.assign(base, {
      Pages: `${(n % 400) + 100}`,
      Language: "English",
      "Cover Type": n % 2 === 0 ? "Paperback" : "Hardcover",
      Publisher: ["HarperCollins", "Penguin", "Random House", "Scholastic"][n % 4],
    });
  }

  return base;
}

interface Review {
  _id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  ratings: number;
  numReviews: number;
  stock: number;
  category: { _id: string; name: string; slug: string };
  reviews: Review[];
}

export default function ProductDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [pincodeInput, setPincodeInput] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<"idle" | "deliverable" | "not-deliverable" | "invalid">("idle");
  const [specsOpen, setSpecsOpen] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [wishlistToast, setWishlistToast] = useState<"added" | "removed" | null>(null);

  // Load wishlist state from localStorage once product loads
  useEffect(() => {
    if (id) {
      const saved: string[] = JSON.parse(localStorage.getItem("wishlist") ?? "[]");
      setWishlisted(saved.includes(id));
    }
  }, [id]);

  const toggleWishlist = () => {
    if (!id) return;
    const saved: string[] = JSON.parse(localStorage.getItem("wishlist") ?? "[]");
    let next: string[];
    const adding = !wishlisted;
    if (wishlisted) {
      next = saved.filter((x) => x !== id);
    } else {
      next = [...saved, id];
    }
    localStorage.setItem("wishlist", JSON.stringify(next));
    setWishlisted(adding);
    setWishlistToast(adding ? "added" : "removed");
    setTimeout(() => setWishlistToast(null), 2500);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name ?? "Product", url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!");
      setTimeout(() => setShareMsg(""), 2000);
    }
  };

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    productService
      .getProduct(id)
      .then((res) => {
        const p: Product = res.data.product;
        setProduct(p);
        return productService.getProducts({ category: p.category?.slug, limit: 4 });
      })
      .then((res) => {
        const all: Product[] = res.data.products;
        setRelatedProducts(all.filter((p) => p._id !== id).slice(0, 4));
      })
      .catch(() => setError("Product not found"))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex justify-center">
        <div className="animate-pulse text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-xl font-medium">{error || "Product not found"}</p>
        <Link to="/products" className="text-primary hover:underline">Browse all products</Link>
      </div>
    );
  }

  const images = product.images.length > 0 ? product.images : ["/placeholder.png"];
  const rating = seededRating(product._id);
  const numReviews = seededNumReviews(product._id);
  const mrp = getMRP(product.price, product._id);
  const discPct = seededDiscount(product._id);
  const specs = getSpecs(product);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Wishlist toast */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        wishlistToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}>
        <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${
          wishlistToast === "added" ? "bg-red-500" : "bg-slate-600"
        }`}>
          <Heart className={`w-4 h-4 ${wishlistToast === "added" ? "fill-white" : ""}`} />
          {wishlistToast === "added" ? "Added to Wishlist!" : "Removed from Wishlist"}
        </div>
      </div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary">Products</Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        {/* Product Images */}
        <div>
          <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-4">
            <img
              src={images[selectedImage]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImage === index ? "border-primary" : "border-transparent"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{product.category?.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{product.name}</h1>

          {/* Rating row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`} />
              ))}
            </div>
            <span className="text-sm font-bold">{rating}</span>
            <span className="text-sm text-muted-foreground">({numReviews.toLocaleString()} reviews)</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-3xl font-extrabold text-foreground">${product.price.toFixed(2)}</span>
            <span className="text-lg text-muted-foreground line-through">MRP ${mrp.toFixed(2)}</span>
            <span className="px-2.5 py-0.5 bg-green-500 text-white rounded-full text-sm font-bold">{discPct}% off</span>
          </div>

          <p className="text-muted-foreground mb-5 leading-relaxed">{product.description}</p>

          {/* Stock */}
          <div className="mb-5">
            {product.stock > 0 ? (
              <span className="inline-flex items-center gap-2 text-green-600 font-medium text-sm">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                In Stock ({product.stock} available)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-destructive font-medium text-sm">
                <span className="w-2 h-2 bg-destructive rounded-full"></span>
                Out of Stock
              </span>
            )}
          </div>

          {/* Quantity + Actions */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2.5 hover:bg-accent transition-colors font-bold">−</button>
              <span className="px-5 py-2.5 border-x border-border font-semibold">{quantity}</span>
              <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="px-4 py-2.5 hover:bg-accent transition-colors font-bold">+</button>
            </div>

            <Button
              variant="primary"
              size="lg"
              className={`flex-1 min-w-[130px] transition-all duration-200 ${
                cartAdded
                  ? "bg-green-600 shadow-md scale-95"
                  : "bg-green-400 hover:bg-green-500 hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg"
              }`}
              disabled={product.stock === 0}
              onClick={() => {
                addToCart({ _id: product._id, name: product.name, price: product.price, image: images[0], stock: product.stock }, quantity);
                setCartAdded(true);
                setTimeout(() => setCartAdded(false), 1500);
              }}
            >
              {cartAdded ? <><Check className="w-5 h-5 mr-2" /> Added!</> : <><ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart</>}
            </Button>

            <Button
              variant="primary"
              size="lg"
              className="flex-1 min-w-[130px] hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              disabled={product.stock === 0}
              onClick={() =>
                navigate("/buy-now", {
                  state: {
                    product: {
                      _id: product._id,
                      name: product.name,
                      price: product.price,
                      image: images[0],
                      stock: product.stock,
                    },
                    quantity,
                  },
                })
              }
            >
              <Zap className="w-5 h-5 mr-2" /> Buy Now
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={toggleWishlist}
              className={`transition-colors ${
                wishlisted ? "border-red-400 text-red-500 bg-red-50 hover:bg-red-100" : ""
              }`}
              title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart className={`w-5 h-5 transition-all ${wishlisted ? "fill-red-500 text-red-500" : ""}`} />
            </Button>

            <div className="relative">
              <Button variant="outline" size="lg" onClick={handleShare} title="Share product">
                {shareMsg ? <Link2 className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
              </Button>
              {shareMsg && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap">
                  {shareMsg}
                </span>
              )}
            </div>
          </div>

          {/* Pincode delivery check */}
          <div className="rounded-xl border border-border p-3 mb-5 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Check Delivery
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={pincodeInput} maxLength={6} placeholder="Enter pincode (5 or 6 digits)"
                  onChange={(e) => { setPincodeInput(e.target.value); setPincodeStatus("idle"); }}
                  onKeyDown={(e) => e.key === "Enter" && (() => setPincodeStatus(checkPinDeliverability(pincodeInput)))()}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setPincodeStatus(checkPinDeliverability(pincodeInput))}>
                Check
              </Button>
            </div>
            {pincodeStatus === "deliverable" && (
              <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Delivery available to {pincodeInput}</p>
                  <p className="text-xs">Standard: 5–7 days &nbsp;·&nbsp; Express: 2–3 days &nbsp;·&nbsp; Overnight available</p>
                </div>
              </div>
            )}
            {pincodeStatus === "not-deliverable" && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> Sorry, we currently don't deliver to pincode {pincodeInput}.
              </div>
            )}
            {pincodeStatus === "invalid" && (
              <p className="text-xs text-destructive">Please enter a valid 5 or 6 digit pincode.</p>
            )}
          </div>

          {/* Features row */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-xs">Free Shipping</div>
                <div className="text-xs text-muted-foreground">Orders over $50</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-xs">Secure Pay</div>
                <div className="text-xs text-muted-foreground">100% protected</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-xs">Easy Returns</div>
                <div className="text-xs text-muted-foreground">30-day policy</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications Section */}
      <div className="mb-10 bg-white rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setSpecsOpen(!specsOpen)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Product Specifications
          </h2>
          {specsOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>
        {specsOpen && (
          <div className="border-t border-border">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(specs).map(([key, val], i) => (
                  <tr key={key} className={i % 2 === 0 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="px-6 py-3 font-medium text-muted-foreground w-40 sm:w-56">{key}</td>
                    <td className="px-6 py-3 text-foreground">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-5">Customer Reviews</h2>

        {/* Rating summary */}
        <div className="bg-white rounded-2xl border border-border p-5 mb-5 flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center flex-shrink-0">
            <div className="text-6xl font-extrabold text-foreground">{rating}</div>
            <div className="flex items-center justify-center gap-1 my-1">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{numReviews.toLocaleString()} ratings</p>
          </div>
          <div className="flex-1 w-full space-y-1.5">
            {[5,4,3,2,1].map((star) => {
              // Seeded bar widths, biased toward 4-5
              let h2 = 0;
              const k = product._id + star;
              for (let i = 0; i < k.length; i++) h2 = (Math.imul(31, h2) + k.charCodeAt(i)) | 0;
              const pcts: Record<number,number> = { 5: 45 + (Math.abs(h2) % 30), 4: 20 + (Math.abs(h2) % 25), 3: 5 + (Math.abs(h2) % 10), 2: 2 + (Math.abs(h2) % 5), 1: 1 + (Math.abs(h2) % 3) };
              const pct = pcts[star];
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right text-muted-foreground">{star}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {product.reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">No written reviews yet.</p>
          ) : (
            product.reviews.map((review) => (
              <div key={review._id} className="bg-white rounded-xl border border-border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-sm">{review.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center">
                        {[1,2,3,4,5].map((i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{review.comment}</p>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <ThumbsUp className="w-3.5 h-3.5" /> Helpful
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related Products */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Related Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((p) => (
            <ProductCard
              key={p._id}
              id={p._id}
              name={p.name}
              price={p.price}
              image={p.images[0]}
              rating={p.ratings}
              reviews={p.numReviews}
              category={p.category?.name}
              stock={p.stock}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
