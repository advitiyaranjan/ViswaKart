import { useSearchParams, Link } from "react-router";
import { useState, useEffect } from "react";
import { productService } from "../../services/productService";
import { CatalogGrid, CatalogMessage, CatalogPagination, type CatalogProduct } from "../components/CatalogUI";
import { Button } from "../components/Button";

const PAGE_SIZE = 20;

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    if (!query) {
      setResults([]);
      setTotal(0);
      return;
    }
    setIsLoading(true);
    setError(false);
    productService
      .getProducts({ search: query, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!current) return;
        setResults(res.data.products ?? []);
        setTotal(res.data.total ?? 0);
        setPages(Math.max(1, res.data.pages ?? 1));
      })
      .catch(() => current && setError(true))
      .finally(() => current && setIsLoading(false));
    return () => {
      current = false;
    };
  }, [query, page, refresh]);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams);
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    setSearchParams(params);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Search</p>
        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
          {query ? `Results for “${query}”` : "Search the collection"}
        </h1>
        {query && !isLoading && !error && (
          <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"} found
          </p>
        )}
      </div>

      {!query ? (
        <CatalogMessage title="What are you looking for?" message="Type a product name in the search bar above." />
      ) : error ? (
        <CatalogMessage
          error
          title="Search is taking a moment"
          message="We couldn't load results. Check your connection and try again."
          onAction={() => setRefresh((value) => value + 1)}
        />
      ) : !isLoading && results.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white px-5 py-14 text-center">
          <h2 className="mb-2 text-xl font-semibold">No products match “{query}”</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            Check the spelling, try a shorter name, or browse the full collection.
          </p>
          <Link to="/products">
            <Button variant="outline">Browse all products</Button>
          </Link>
        </div>
      ) : (
        <>
          <CatalogGrid products={results} loading={isLoading} skeletons={8} />
          {!isLoading && <CatalogPagination page={page} pages={pages} onChange={goToPage} />}
        </>
      )}
    </div>
  );
}
