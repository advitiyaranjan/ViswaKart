import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router";
import { ChevronRight, RefreshCw, Store } from "lucide-react";
import { userService } from "../../../services/userService";
import { canViewSellPath, sellerDestination, type SellerSummary } from "../../../lib/seller";
import { Button } from "../../components/Button";

/** Fetches the signed-in user's seller status from the server (never from cached client state). */
export function useSellerStatus() {
  const [seller, setSeller] = useState<SellerSummary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    userService
      .getMySellerStatus()
      .then(({ data }) => active && setSeller(data.seller))
      .catch((err) => active && setError(err?.response?.data?.message || "We couldn't check your seller account."));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { seller, setSeller, error, reload, loading: !seller && !error };
}

export function SellerPageLoading({ label = "Checking your seller account…" }: { label?: string }) {
  return (
    <div role="status" className="mx-auto max-w-3xl px-4 py-16">
      <div className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SellerPageError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">We couldn't open the seller area</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <Button className="mt-6" onClick={retry}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

/**
 * Renders a sell-flow page only when the seller's server-side status allows it,
 * otherwise redirects to the page that status belongs on. Direct links get the same rules as the CTA.
 */
export function SellerGate({ path, children }: { path: string; children: (ctx: ReturnType<typeof useSellerStatus> & { seller: SellerSummary }) => ReactNode }) {
  const ctx = useSellerStatus();
  if (ctx.error) return <SellerPageError message={ctx.error} retry={ctx.reload} />;
  if (!ctx.seller) return <SellerPageLoading />;
  if (!canViewSellPath(path, ctx.seller)) return <Navigate to={sellerDestination(ctx.seller)} replace />;
  return <>{children({ ...ctx, seller: ctx.seller })}</>;
}

/** Common page frame for the sell flow: breadcrumb, title and description. */
export function SellerPageFrame({ title, description, actions, children, wide = false }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Store className="h-3.5 w-3.5 text-primary" />
          Sell on ViswaKart
        </span>
      </nav>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export const sellerFieldClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 aria-[invalid=true]:border-destructive sm:text-sm";
