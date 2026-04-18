import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Heart, ShoppingCart, Trash2, Package } from "lucide-react";
import { productService } from "../../services/productService";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { Button } from "../components/Button";

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
  category: { name: string };
}

function seededDiscount(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return 14 + (Math.abs(h) % 67);
}

export default function Wishlist() {
  const { addToCart } = useCart();
  const { wishlist: wishlistIds, toggleWishlist, loading: wishlistLoading } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (wishlistIds.length === 0) { setProducts([]); return; }
    setLoading(true);
    Promise.all(wishlistIds.map((id) => productService.getProduct(id).then((r) => r.data.product).catch(() => null)))
      .then((results) => setProducts(results.filter(Boolean) as Product[]))
      .finally(() => setLoading(false));
  }, [wishlistIds]);

  // Keep products in sync when an item is removed
  useEffect(() => {
    setProducts((p) => p.filter((x) => wishlistIds.includes(x._id)));
  }, [wishlistIds]);

  const remove = (id: string) => toggleWishlist(id);

  const handleAddToCart = (product: Product) => {
    addToCart({ _id: product._id, name: product.name, price: product.price, image: product.images[0], stock: product.stock });
    setAddedIds((prev) => new Set(prev).add(product._id));
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(product._id); return n; }), 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" />
        <h1 className="text-2xl font-bold">My Wishlist</h1>
        {wishlistIds.length > 0 && (
          <span className="bg-red-100 text-red-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {wishlistIds.length} item{wishlistIds.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {(loading || wishlistLoading) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wishlistIds.map((id) => (
            <div key={id} className="bg-white rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-9 bg-slate-100 rounded mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center">
            <Heart className="w-12 h-12 text-red-300" />
          </div>
          <h2 className="text-xl font-bold">Your wishlist is empty</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Save the products you love by clicking the heart icon on any product page.
          </p>
          <Link to="/products">
            <Button variant="primary" size="lg">Browse Products</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const discPct = seededDiscount(product._id);
            const mrp = product.price / (1 - discPct / 100);
            return (
              <div key={product._id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <Link to={`/products/${product._id}`}>
                    <img
                      src={product.images?.[0] || "/placeholder.png"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>
                  <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    {discPct}% off
                  </span>
                  <button
                    onClick={() => remove(product._id)}
                    className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:bg-red-50 transition-colors"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <span className="bg-white border border-border rounded-lg px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Out of Stock
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{product.category?.name}</p>
                  <Link to={`/products/${product._id}`}>
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors mb-2">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-extrabold">${product.price.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground line-through">${mrp.toFixed(2)}</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={product.stock === 0}
                    onClick={() => handleAddToCart(product)}
                  >
                    {addedIds.has(product._id) ? (
                      <><Package className="w-4 h-4 mr-1.5" /> Added!</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4 mr-1.5" /> Add to Cart</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
