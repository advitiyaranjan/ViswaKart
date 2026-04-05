import { Link } from "react-router";
import { Star, ShoppingCart, Check } from "lucide-react";
import { Button } from "./Button";
import { useCart } from "../../context/CartContext";
import { useState } from "react";

interface ProductCardProps {
  id: string | number;
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  inStock?: boolean;
  description?: string;
  category?: string;
  stock?: number;
}

export function ProductCard({
  id,
  name,
  price,
  originalPrice,
  rating,
  reviews,
  image,
  inStock,
  description = "",
  stock = 0,
}: ProductCardProps) {
  const isInStock = inStock !== undefined ? inStock : stock > 0;
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  // Deterministic discount % (14–80) seeded from product id
  function seededDiscount(seed: string | number) {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return 14 + (Math.abs(h) % 67);
  }
  function seededRating(seed: string | number) {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    const r = Math.abs(h) % 100;
    if (r < 5)  return parseFloat((2 + r * 0.18).toFixed(1));
    if (r < 20) return parseFloat((3 + ((r - 5) / 15) * 0.9).toFixed(1));
    return parseFloat((4 + (r - 20) / 80).toFixed(1));
  }
  function seededNumReviews(seed: string | number) {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i) * 7) | 0;
    return 12 + (Math.abs(h) % 489);
  }
  const discountPct = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : seededDiscount(id);
  const mrp = originalPrice ?? price / (1 - discountPct / 100);
  const displayRating = rating && rating > 0 ? rating : seededRating(id);
  const displayReviews = reviews && reviews > 0 ? reviews : seededNumReviews(id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart({ _id: String(id), name, price, image, stock });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Link to={`/products/${id}`} className="group">
      <div className="bg-card rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {discountPct > 0 && (
            <div className="absolute top-3 left-3 bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold">
              {discountPct}% off
            </div>
          )}
          {!isInStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-foreground px-4 py-2 rounded-lg font-semibold">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-medium text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {name}
          </h3>

          <div className="flex items-center gap-1 mb-3">
            <div className="flex items-center">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="ml-1 text-sm font-medium">{displayRating}</span>
            </div>
            <span className="text-sm text-muted-foreground">({displayReviews.toLocaleString()})</span>
          </div>

          <div className="mt-auto">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-semibold text-foreground">${price}</span>
              <span className="text-sm text-muted-foreground line-through">${mrp.toFixed(2)}</span>
              <span className="text-xs font-semibold text-green-600">{discountPct}% off</span>
            </div>

            <Button
              variant="primary"
              className={`w-full transition-all duration-300 ${added ? "bg-green-500 hover:bg-green-500 scale-95" : ""}`}
              onClick={handleAddToCart}
              disabled={!isInStock}
            >
              {added ? (
                <><Check className="w-4 h-4 mr-2 animate-bounce" /> Added!</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
