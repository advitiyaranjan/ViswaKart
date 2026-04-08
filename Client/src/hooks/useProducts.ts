import { useState, useEffect } from "react";
import { productService, getCachedProductsData } from "../services/productService";
import type { ProductQueryParams } from "../services/productService";

interface Product {
  _id: string;
  name: string;
  price: number;
  originalPrice?: number;
  ratings: number;
  numReviews: number;
  images: string[];
  inStock: boolean;
  isFeatured: boolean;
  category: { _id: string; name: string; slug: string };
  description: string;
  stock: number;
}

interface UseProductsReturn {
  products: Product[];
  total: number;
  pages: number;
  page: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProducts(params: ProductQueryParams = {}): UseProductsReturn {
  const initialCache = getCachedProductsData(params);
  const [products, setProducts] = useState<Product[]>(() => initialCache?.products ?? []);
  const [total, setTotal] = useState(() => initialCache?.total ?? 0);
  const [pages, setPages] = useState(() => initialCache?.pages ?? 1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedProductsData(params);
    if (cached) {
      setProducts(cached.products ?? []);
      setTotal(cached.total ?? 0);
      setPages(cached.pages ?? 1);
      setPage(cached.page ?? 1);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    productService
      .getProducts(params)
      .then((res) => {
        if (!cancelled) {
          setProducts(res.data.products);
          setTotal(res.data.total);
          setPages(res.data.pages);
          setPage(res.data.page);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || "Failed to load products");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), trigger]);

  return { products, total, pages, page, isLoading, error, refetch: () => setTrigger((t) => t + 1) };
}
