import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { Button } from "../components/Button";
import { productService, categoryService } from "../../services/productService";
import { formatCurrency } from "../../lib/currency";
import { ProductCardSkeleton } from "../components/LoadingStates";
import * as Slider from "@radix-ui/react-slider";

interface Category {
  _id: string;
  name: string;
  slug: string;
  productCount?: number;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  originalPrice?: number;
  ratings: number;
  numReviews: number;
  images: string[];
  inStock: boolean;
  description: string;
  stock: number;
  category: { _id: string; name: string; slug: string };
}

export default function ProductListing() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState(
    () => searchParams.get("category") ?? ""
  );
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [sortBy, setSortBy] = useState("-createdAt");
  const [showFilters, setShowFilters] = useState(false);

  // Sync category filter when URL param changes (e.g. clicking navbar links)
  useEffect(() => {
    const urlCategory = searchParams.get("category") ?? "";
    setSelectedCategory(urlCategory);
    setPage(1);
  }, [searchParams]);

  // Load categories once
  useEffect(() => {
    categoryService.getCategories().then((res) => setCategories(res.data.categories));
  }, []);

  const fetchProducts = useCallback(() => {
    setIsLoading(true);
    productService
      .getProducts({
        page,
        limit: 12,
        category: selectedCategory || undefined,
        minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
        maxPrice: priceRange[1] < 500 ? priceRange[1] : undefined,
        sort: sortBy,
      })
      .then((res) => {
        setProducts(res.data.products);
        setTotal(res.data.total);
        setPages(res.data.pages);
      })
      .finally(() => setIsLoading(false));
  }, [page, selectedCategory, priceRange, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Deduplicate by _id then filter client-side by rating
  const uniqueProducts = products.filter(
    (p, i, arr) => arr.findIndex((x) => x._id === p._id) === i
  );
  const filteredProducts = selectedRating > 0
    ? uniqueProducts.filter((p) => p.ratings >= selectedRating)
    : uniqueProducts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">All Products</h1>
          <p className="text-muted-foreground">
            Showing {filteredProducts.length} of {total} products
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>

          <div className="flex flex-col items-center gap-1">
            <label className="text-base font-semibold text-foreground">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="px-4 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
            <option value="-createdAt">Newest</option>
            <option value="price">Price: Low to High</option>
            <option value="-price">Price: High to Low</option>
            <option value="-ratings">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <aside
          className={`lg:w-64 space-y-6 ${showFilters ? "block" : "hidden lg:block"}`}
        >
          <div className="bg-white rounded-xl border border-border p-6 sticky top-20">
            <h3 className="font-semibold mb-4">Filters</h3>

            {/* Category Filter */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">Category</h4>
              <div className="space-y-2">
                {categories.map((category) => (
                  <label key={category._id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategory === category.slug}
                      onChange={(e) => {
                        setSelectedCategory(e.target.checked ? category.slug : "");
                        setPage(1);
                      }}
                      className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                    />
                    <span className="text-sm">{category.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({category.productCount ?? 0})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="mb-6">
                <h4 className="font-medium mb-3">
                  Price Range: {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                </h4>
              <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-5"
                value={priceRange}
                onValueChange={(v) => { setPriceRange(v); setPage(1); }}
                max={500}
                step={10}
              >
                <Slider.Track className="bg-muted relative grow rounded-full h-2">
                  <Slider.Range className="absolute bg-primary rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-5 h-5 bg-white border-2 border-primary rounded-full hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring" />
                <Slider.Thumb className="block w-5 h-5 bg-white border-2 border-primary rounded-full hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring" />
              </Slider.Root>
            </div>

            {/* Rating Filter */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">Minimum Rating</h4>
              <div className="space-y-2">
                {[4, 3, 2, 1].map((rating) => (
                  <label key={rating} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rating"
                      checked={selectedRating === rating}
                      onChange={() => setSelectedRating(rating)}
                      className="w-4 h-4 text-primary border-border focus:ring-primary"
                    />
                    <span className="text-sm">{rating}+ Stars</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div className="mb-6">
              <h4 className="font-medium mb-3">Availability</h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
                <span className="text-sm">In Stock Only</span>
              </label>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedCategory("");
                setPriceRange([0, 500]);
                setSelectedRating(0);
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  id={product._id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.originalPrice}
                  rating={product.ratings}
                  reviews={product.numReviews}
                  image={product.images[0] || ""}
                  stock={product.stock}
                  description={product.description}
                  category={product.category?.name || ""}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "primary" : "outline"}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
