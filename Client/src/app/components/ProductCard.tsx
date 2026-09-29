import { Link } from "react-router";
import { Star, ShoppingCart, Check, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./Button";
import { ProductImage } from "./ProductImage";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { formatCurrency } from "../../lib/currency";
import { getProductPricing } from "../../lib/commerce";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  category?: string;
  /** Units the customer can buy (already accounts for sold/inactive listings). */
  stock?: number;
}

export function ProductCard({ id, name, price, originalPrice, rating, reviews, image, category, stock = 0 }: ProductCardProps) {
  const { addToCart, items } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [added, setAdded] = useState(false);
  const pricing = getProductPricing({ price, originalPrice });
  const wishlisted = isWishlisted(id);
  const inCart = items.find((item) => item._id === id)?.quantity || 0;
  const soldOut = stock <= 0;
  const atLimit = !soldOut && inCart >= stock;

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);

  const label = added ? "Added to cart" : soldOut ? "Sold out" : atLimit ? "All in your cart" : "Add to cart";

  return (
    <article className="product-card group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-square overflow-hidden bg-[#f0f3f1]">
        <Link to={`/products/${id}`} aria-label={`View ${name}`} className="block h-full p-3 sm:p-5">
          <ProductImage
            src={image}
            alt={name}
            loading="lazy"
            className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 ${soldOut ? "opacity-60" : ""}`}
          />
        </Link>
        {pricing.discount > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-sm">
            {pricing.discount}% off
          </span>
        )}
        <button
          type="button"
          onClick={() => void toggleWishlist(id)}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-muted-foreground shadow-sm transition-colors hover:text-rose-600"
        >
          <Heart className={`h-[18px] w-[18px] ${wishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
        {soldOut && (
          <span className="absolute bottom-3 left-3 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-white">Sold out</span>
        )}
        {!soldOut && stock <= 3 && (
          <span className="absolute bottom-3 left-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            Only {stock} left
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-5">
        {category && <p className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{category}</p>}
        <Link
          to={`/products/${id}`}
          className="mb-2 line-clamp-2 text-sm font-semibold leading-relaxed text-foreground hover:text-primary sm:text-base"
        >
          {name}
        </Link>
        <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          {reviews > 0 ? (
            <>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              <span className="font-semibold text-foreground">{Number(rating || 0).toFixed(1)}</span>
              <span>({reviews})</span>
            </>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>
        <div className="mt-auto">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-bold tracking-tight sm:text-xl">{formatCurrency(pricing.price)}</span>
            {pricing.originalPrice > pricing.price && (
              <span className="text-xs text-muted-foreground line-through">{formatCurrency(pricing.originalPrice)}</span>
            )}
          </div>
          <Button
            className="w-full px-2 text-xs sm:text-sm"
            variant={added ? "secondary" : "primary"}
            disabled={soldOut || atLimit}
            onClick={() => {
              addToCart({
                _id: id,
                name,
                price: pricing.price,
                image,
                stock,
                originalPrice: pricing.originalPrice,
                discount: pricing.discount,
              });
              setAdded(true);
            }}
          >
            {added ? <Check className="h-4 w-4 shrink-0" /> : <ShoppingCart className="h-4 w-4 shrink-0" />}
            <span aria-live="polite">{label}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
