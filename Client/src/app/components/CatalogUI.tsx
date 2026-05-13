import { AlertCircle, ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./LoadingStates";
import { Button } from "./Button";
import { availableStock } from "../../lib/commerce";

export interface CatalogReview {
  _id: string;
  user?: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CatalogProduct {
  _id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  ratings: number;
  numReviews: number;
  stock: number;
  sold?: boolean;
  isActive?: boolean;
  seller?: string | null;
  sellerEmail?: string | null;
  sellerHostelNumber?: string;
  category?: { _id: string; name: string; slug: string };
  specifications?: string | Record<string, unknown>;
  productAge?: string;
  reviews?: CatalogReview[];
}

export interface CatalogCategory {
  _id: string;
  name: string;
  slug: string;
  productCount?: number;
  image?: string;
}

export function ProductTile({ product }: { product: CatalogProduct }) {
  return (
    <ProductCard
      id={product._id}
      name={product.name}
      price={product.price}
      originalPrice={product.originalPrice}
      rating={product.ratings}
      reviews={product.numReviews}
      image={product.images?.[0] || ""}
      stock={availableStock(product)}
      category={product.category?.name}
    />
  );
}

export function CatalogGrid({
  products,
  loading = false,
  columns = 4,
  skeletons,
}: {
  products: CatalogProduct[];
  loading?: boolean;
  columns?: 3 | 4;
  skeletons?: number;
}) {
  return (
    <div
      aria-busy={loading}
      className={`grid grid-cols-2 gap-3 sm:gap-5 ${columns === 3 ? "md:grid-cols-3" : "md:grid-cols-3 lg:grid-cols-4"}`}
    >
      {loading
        ? Array.from({ length: skeletons ?? columns }).map((_, i) => <ProductCardSkeleton key={i} />)
        : products.map((product) => <ProductTile key={product._id} product={product} />)}
    </div>
  );
}

interface CatalogMessageProps {
  error?: boolean;
  title: string;
  message: string;
  onAction?: () => void;
  action?: string;
}

export function CatalogMessage({ error, title, message, onAction, action = "Try again" }: CatalogMessageProps) {
  const Icon = error ? AlertCircle : PackageSearch;
  return (
    <div role={error ? "alert" : "status"} className="rounded-2xl border border-border bg-white px-5 py-14 text-center">
      <Icon className={`mx-auto mb-4 h-10 w-10 ${error ? "text-destructive" : "text-primary"}`} strokeWidth={1.4} />
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">{message}</p>
      {onAction && (
        <Button variant="outline" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

export function CatalogPagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Product pages" className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Button variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </Button>
      <span className="px-2 text-sm text-muted-foreground">
        Page <strong className="text-foreground">{page}</strong> of {pages}
      </span>
      <Button variant="outline" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
