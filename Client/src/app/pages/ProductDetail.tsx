import { useParams, Link, useNavigate } from "react-router";
import {
  Star,
  ShoppingCart,
  Heart,
  Share2,
  Truck,
  Banknote,
  Undo2,
  AlertCircle,
  Zap,
  ChevronRight,
  Minus,
  Plus,
  Clock,
} from "lucide-react";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { toast } from "sonner";
import { useUser, SignInButton } from "@clerk/react";
import { Button } from "../components/Button";
import { ProductImage } from "../components/ProductImage";
import { CatalogGrid, type CatalogProduct } from "../components/CatalogUI";
import { LoadingSkeleton } from "../components/LoadingStates";
import { productService, getCachedProductData } from "../../services/productService";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../lib/currency";
import { availableStock, getProductPricing, DELIVERY_OPTIONS } from "../../lib/commerce";

function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`} />
      ))}
    </span>
  );
}

function Specifications({ specs }: { specs: CatalogProduct["specifications"] }) {
  if (!specs || (typeof specs === "object" && Object.keys(specs).length === 0)) return null;
  return (
    <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">Specifications</h2>
      {typeof specs === "string" ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{specs}</p>
      ) : (
        <dl className="divide-y divide-border text-sm">
          {Object.entries(specs).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="break-words font-medium">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function ReviewForm({ productId, onPosted }: { productId: string; onPosted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!rating) return setError("Choose a star rating.");
    if (comment.trim().length < 3) return setError("Tell other shoppers a little about the product.");
    setSaving(true);
    setError("");
    try {
      await productService.addReview(productId, { rating, comment: comment.trim() });
      toast.success("Thanks! Your review is live.");
      setRating(0);
      setComment("");
      onPosted();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Your review couldn't be posted. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-white p-5">
      <h3 className="font-semibold">Write a review</h3>
      <fieldset>
        <legend className="mb-2 text-sm text-muted-foreground">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="peer sr-only"
              />
              <span className="flex h-11 w-11 items-center justify-center rounded-lg peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                <Star className={`h-7 w-7 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
              </span>
              <span className="sr-only">
                {value} star{value > 1 ? "s" : ""}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="review-comment" className="mb-2 block text-sm font-medium">
          Your review
        </label>
        <textarea
          id="review-comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What did you like? How was the quality?"
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? "Posting…" : "Post review"}
      </Button>
    </form>
  );
}

export default function ProductDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { addToCart, items } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { isSignedIn } = useUser();
  const { user } = useAuth();
  const [product, setProduct] = useState<CatalogProduct | null>(() => getCachedProductData(id)?.product ?? null);
  const [related, setRelated] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(() => !getCachedProductData(id)?.product);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    const cached = getCachedProductData(id)?.product;
    if (cached && reload === 0) {
      setProduct(cached);
      setIsLoading(false);
    } else if (reload === 0) {
      setIsLoading(true);
    }
    setNotFound(false);
    setLoadError(false);
    productService
      .getProduct(id)
      .then((res) => {
        if (!current) return;
        const next: CatalogProduct = res.data.product;
        setProduct(next);
        if (next.category?.slug) {
          productService
            .getProducts({ category: next.category.slug, limit: 5 })
            .then((r) => current && setRelated((r.data.products as CatalogProduct[]).filter((p) => p._id !== next._id).slice(0, 4)))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (!current) return;
        if (err?.response?.status === 404) setNotFound(true);
        else setLoadError(true);
      })
      .finally(() => current && setIsLoading(false));
    return () => {
      current = false;
    };
  }, [id, reload]);

  useEffect(() => {
    setQuantity(1);
    setSelectedImage(0);
  }, [id]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.name ?? "ViswaKart", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      /* The user dismissed the share sheet. */
    }
  }, [product?.name]);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8" role="status" aria-label="Loading product">
        <LoadingSkeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <LoadingSkeleton className="h-4 w-24" />
          <LoadingSkeleton className="h-9 w-3/4" />
          <LoadingSkeleton className="h-6 w-40" />
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!product || notFound || loadError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center" role="alert">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-semibold">{loadError ? "We couldn't load this product" : "This product isn't available"}</h1>
        <p className="text-muted-foreground">
          {loadError ? "Check your connection and try again." : "It may have sold out or been removed by the seller."}
        </p>
        <div className="flex gap-3">
          {loadError && <Button onClick={() => setReload((value) => value + 1)}>Try again</Button>}
          <Link to="/products">
            <Button variant="outline">Browse products</Button>
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [""];
  const pricing = getProductPricing(product);
  const available = availableStock(product);
  const inCart = items.find((item) => item._id === product._id)?.quantity ?? 0;
  const canAdd = Math.max(0, available - inCart);
  const wishlisted = isWishlisted(product._id);
  const reviews = product.reviews ?? [];
  const alreadyReviewed = Boolean(user && reviews.some((review) => String(review.user) === String(user._id)));
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => Math.round(review.rating) === star).length,
  }));
  const cartItem = {
    _id: product._id,
    name: product.name,
    price: pricing.price,
    image: images[0],
    stock: available,
    originalPrice: pricing.originalPrice,
    discount: pricing.discount,
  };

  function handleAddToCart() {
    const amount = Math.min(quantity, canAdd);
    if (amount <= 0) return;
    addToCart(cartItem, amount);
    toast.success(`${amount} × ${product!.name} added to your cart`, { action: { label: "View cart", onClick: () => navigate("/cart") } });
    setQuantity(1);
  }

  function handleBuyNow() {
    navigate("/buy-now", { state: { product: cartItem, quantity: Math.min(quantity, available) } });
  }

  const addLabel = available === 0 ? "Sold out" : canAdd === 0 ? "All in your cart" : "Add to cart";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/" className="shrink-0 hover:text-primary">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        {product.category ? (
          <Link to={`/products?category=${encodeURIComponent(product.category.slug)}`} className="shrink-0 hover:text-primary">
            {product.category.name}
          </Link>
        ) : (
          <Link to="/products" className="shrink-0 hover:text-primary">
            Shop
          </Link>
        )}
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span aria-current="page" className="truncate text-foreground">
          {product.name}
        </span>
      </nav>

      <div className="mb-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-[#f0f3f1] p-6 sm:p-10">
            <ProductImage src={images[selectedImage]} alt={product.name} fetchPriority="high" className="h-full w-full object-contain" />
            {pricing.discount > 0 && (
              <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-sm font-semibold text-primary shadow-sm">
                {pricing.discount}% off
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto pb-1" role="group" aria-label="Product images">
              {images.map((img, index) => (
                <button
                  key={`${img}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-pressed={selectedImage === index}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[#f0f3f1] p-1.5 transition-colors ${selectedImage === index ? "border-primary" : "border-transparent hover:border-border"}`}
                >
                  <ProductImage src={img} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {product.category && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{product.category.name}</p>
          )}
          <h1 className="mb-3 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{product.name}</h1>

          <a href="#reviews" className="mb-5 inline-flex min-h-8 items-center gap-2 text-sm">
            {product.numReviews > 0 ? (
              <>
                <Stars value={product.ratings} />
                <span className="font-semibold">{Number(product.ratings).toFixed(1)}</span>
                <span className="text-muted-foreground underline-offset-2 hover:underline">
                  {product.numReviews} review{product.numReviews === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground underline-offset-2 hover:underline">No reviews yet — be the first</span>
            )}
          </a>

          <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold tracking-tight">{formatCurrency(pricing.price)}</span>
            {pricing.originalPrice > pricing.price && (
              <>
                <span className="text-base text-muted-foreground line-through">{formatCurrency(pricing.originalPrice)}</span>
                <span className="text-sm font-semibold text-primary">You save {formatCurrency(pricing.originalPrice - pricing.price)}</span>
              </>
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            {available > 0 ? (
              <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                {available <= 3 ? `Only ${available} left` : "In stock"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 font-medium text-destructive">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                Sold out
              </span>
            )}
            {inCart > 0 && (
              <Link to="/cart" className="text-muted-foreground underline-offset-2 hover:underline">
                {inCart} already in your cart
              </Link>
            )}
            {product.productAge && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Used for {product.productAge}
              </span>
            )}
          </div>

          {available > 0 && (
            <div className="mb-4 flex items-center gap-4">
              <span id="quantity-label" className="text-sm font-medium">
                Quantity
              </span>
              <div
                className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-white"
                role="group"
                aria-labelledby="quantity-label"
              >
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-semibold" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= available}
                  onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                  className="flex h-11 w-11 items-center justify-center hover:bg-muted disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div data-testid="product-actions" className="mb-6 hidden gap-3 lg:flex">
            <Button size="lg" className="flex-1" disabled={canAdd === 0} onClick={handleAddToCart}>
              <ShoppingCart className="h-5 w-5" />
              {addLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 border-primary/40 text-primary"
              disabled={available === 0}
              onClick={handleBuyNow}
            >
              <Zap className="h-5 w-5" />
              Buy now
            </Button>
          </div>

          <div className="mb-7 flex gap-2">
            <Button
              variant="outline"
              onClick={() => void toggleWishlist(product._id)}
              aria-pressed={wishlisted}
              className={wishlisted ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100" : ""}
            >
              <Heart className={`h-5 w-5 ${wishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
              {wishlisted ? "Saved" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => void handleShare()}>
              <Share2 className="h-5 w-5" />
              Share
            </Button>
          </div>

          {product.description && (
            <div className="mb-7">
              <h2 className="mb-2 text-base font-semibold">About this product</h2>
              <p className="whitespace-pre-line break-words leading-relaxed text-muted-foreground">{product.description}</p>
            </div>
          )}

          <ul className="grid gap-3 rounded-2xl border border-border bg-white p-4 text-sm sm:grid-cols-3">
            <li className="flex gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Free delivery</span>
                <span className="text-muted-foreground">Standard, {DELIVERY_OPTIONS[0].eta}</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Pay on delivery</span>
                <span className="text-muted-foreground">Cash when it arrives</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium">Cancel anytime</span>
                <span className="text-muted-foreground">Until it ships</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mb-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Specifications specs={product.specifications} />

        <section id="reviews" className={`scroll-mt-40 ${product.specifications ? "" : "lg:col-span-2"}`}>
          <h2 className="mb-4 text-xl font-semibold">Customer reviews</h2>
          {reviews.length > 0 && (
            <div className="mb-5 flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center">
              <div className="shrink-0 text-center sm:w-32">
                <p className="text-5xl font-bold">{Number(product.ratings).toFixed(1)}</p>
                <div className="my-1.5 flex justify-center">
                  <Stars value={product.ratings} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="w-full flex-1 space-y-1.5">
                {distribution.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-muted-foreground">{star} ★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / reviews.length) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-5">
            {!isSignedIn ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-white p-5 text-sm">
                <span className="text-muted-foreground">Bought this? Sign in to share your experience.</span>
                <SignInButton mode="modal">
                  <Button variant="outline">Sign in to review</Button>
                </SignInButton>
              </div>
            ) : alreadyReviewed ? (
              <p className="rounded-2xl bg-accent/40 p-4 text-sm text-accent-foreground">Thanks for reviewing this product.</p>
            ) : (
              <ReviewForm productId={product._id} onPosted={() => setReload((value) => value + 1)} />
            )}
          </div>

          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {[...reviews].reverse().map((review) => (
                <li key={review._id} className="rounded-2xl border border-border bg-white p-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{review.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Stars value={review.rating} size="h-3.5 w-3.5" />
                    <span className="sr-only">{review.rating} out of 5 stars</span>
                  </div>
                  <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">You may also like</h2>
          <CatalogGrid products={related} />
        </section>
      )}

      {/* Phone action bar: always reachable with a thumb. */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pt-3 backdrop-blur-xl lg:hidden">
        <div data-testid="product-actions" className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-lg font-bold leading-tight">{formatCurrency(pricing.price)}</p>
            {quantity > 1 && <p className="text-xs text-muted-foreground">× {quantity}</p>}
          </div>
          <Button className="flex-1 px-3" disabled={canAdd === 0} onClick={handleAddToCart}>
            <ShoppingCart className="h-4 w-4" />
            {addLabel}
          </Button>
          <Button
            variant="outline"
            className="shrink-0 border-primary/40 px-3 text-primary"
            disabled={available === 0}
            onClick={handleBuyNow}
            aria-label="Buy now"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden min-[380px]:inline">Buy now</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
