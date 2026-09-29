import type { ReactNode } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, Loader2, RefreshCw } from "lucide-react";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15";
export const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
export const actionClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-teal-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40";
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const value = error as { response?: { data?: { message?: string; errors?: { msg: string }[] } } };
  return value?.response?.data?.message || value?.response?.data?.errors?.[0]?.msg || fallback;
}
export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Store workspace</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-red-100"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description,
  loading = false,
}: {
  title?: string;
  description?: string;
  loading?: boolean;
}) {
  return (
    <div className="px-5 py-14 text-center" role="status">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Inbox className="h-6 w-6" />}
      </span>
      <p className="font-semibold text-slate-800">{loading ? "Loading your data…" : title}</p>
      {description && !loading && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize = 20,
  onChange,
  loading = false,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  loading?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
      <p className="text-xs text-slate-500">
        {total === 0
          ? "0 results"
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()} results`}
      </p>
      <div className="flex items-center gap-2">
        <button
          aria-label="Previous page"
          disabled={page <= 1 || loading}
          className={`${actionClass} border border-slate-200`}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs text-slate-500">
          Page {page} of {pages}
        </span>
        <button
          aria-label="Next page"
          disabled={page >= pages || loading}
          className={`${actionClass} border border-slate-200`}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
export const statusColors: Record<string, string> = {
  Delivered: "bg-emerald-50 text-emerald-700",
  Shipped: "bg-sky-50 text-sky-700",
  Processing: "bg-amber-50 text-amber-800",
  Pending: "bg-slate-100 text-slate-600",
  Cancelled: "bg-rose-50 text-rose-700",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
export function formatDate(date?: string) {
  return date && !Number.isNaN(Date.parse(date))
    ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}
