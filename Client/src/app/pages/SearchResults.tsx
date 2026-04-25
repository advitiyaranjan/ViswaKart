import { useSearchParams, Link } from "react-router";
import { Search } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, ProductCardSkeleton } from "../components/LoadingStates";
import { productService } from "../../services/productService";
import { useState, useEffect } from "react";

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

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setIsLoading(true);
    productService
      .getProducts({ search: query, limit: 20 })
      .then((res) => {
        setResults(res.data.products);
        setTotal(res.data.total);
      })
      .finally(() => setIsLoading(false));
  }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Search Results for "{query}"
        </h1>
        {!isLoading && (
          <p className="text-muted-foreground">
            Found {total} {total === 1 ? "result" : "results"}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {results.map((product) => (
            <ProductCard
              key={product._id}
              id={product._id}
              name={product.name}
              price={product.price}
              discount={(product as any).discount}
              seller={(product as any).seller}
              sellerEmail={(product as any).sellerEmail}
              image={product.images[0]}
              rating={product.ratings}
              reviews={product.numReviews}
              category={product.category?.name}
              stock={product.stock}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search className="w-16 h-16" />}
          title="No products found"
          description={`We couldn't find any products matching "${query}". Try searching for something else.`}
          action={
            <Link to="/products">
              <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                Browse All Products
              </button>
            </Link>
          }
        />
      )}
    </div>
  );
}
