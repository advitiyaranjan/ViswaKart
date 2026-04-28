import api from "./api";

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  featured?: boolean;
}

const PRODUCT_CACHE_PREFIX = "product-cache:";
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  timestamp: number;
  data: T;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function buildCacheKey(scope: string, input: unknown) {
  return `${PRODUCT_CACHE_PREFIX}${scope}:${typeof input === "string" ? input : JSON.stringify(input)}`;
}

function readCache<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  if (!canUseStorage()) return;
  try {
    const entry: CacheEntry<T> = { timestamp: Date.now(), data };
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}

export function getCachedProductsData(params: ProductQueryParams = {}) {
  return readCache<any>(buildCacheKey("products", params));
}

export function getCachedProductData(id: string) {
  return readCache<any>(buildCacheKey("product", id));
}

export function getCachedCategoriesData() {
  return readCache<any>(buildCacheKey("categories", "all"));
}

export const productService = {
  getProducts: (params: ProductQueryParams = {}) =>
    api.get("/products", { params }).then((res) => {
      writeCache(buildCacheKey("products", params), res.data);
      return res;
    }),

  getProduct: (id: string) =>
    api.get(`/products/${id}`).then((res) => {
      writeCache(buildCacheKey("product", id), res.data);
      return res;
    }),

  createProduct: (data: FormData | object) => api.post("/products", data),

  updateProduct: (id: string, data: object) => api.put(`/products/${id}`, data),

  deleteProduct: (id: string) => api.delete(`/products/${id}`),

  addReview: (id: string, data: { rating: number; comment: string }) =>
    api.post(`/products/${id}/reviews`, data),
};

export const categoryService = {
  getCategories: () => api.get("/categories").then((res) => {
    writeCache(buildCacheKey("categories", "all"), res.data);
    return res;
  }),
  getCategory: (id: string) => api.get(`/categories/${id}`),
  createCategory: (data: object) => api.post("/categories", data),
  updateCategory: (id: string, data: object) => api.put(`/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/categories/${id}`),
};
