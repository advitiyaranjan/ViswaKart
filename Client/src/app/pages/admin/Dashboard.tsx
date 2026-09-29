import { ArrowUpRight, Package, FolderTree, ShoppingBag, Users, Wallet, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState, useCallback } from "react";
import { userService } from "../../../services/userService";
import { Link } from "react-router";
import { formatCurrency } from "../../../lib/currency";
import { PageHeading, ErrorNotice, EmptyState, StatusBadge, formatDate, panelClass, errorMessage } from "./AdminUI";

interface Stats {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  totalUsers: number;
  revenue: number;
}
interface RecentOrder {
  _id: string;
  user?: { name?: string };
  createdAt: string;
  totalPrice: number;
  status: string;
}
interface SalesPoint {
  _id?: number | string | { year: number; month: number };
  month?: string;
  sales: number;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function salesLabel(point: SalesPoint) {
  if (point.month) return point.month;
  if (typeof point._id === "object") return `${MONTHS[point._id.month - 1]} ${point._id.year}`;
  if (typeof point._id === "string" && /^\d{4}-\d{2}$/.test(point._id))
    return `${MONTHS[Number(point._id.slice(5)) - 1]} ${point._id.slice(0, 4)}`;
  return MONTHS[Number(point._id) - 1] || String(point._id);
}
export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [salesData, setSalesData] = useState<{ month: string; sales: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await userService.getDashboardStats();
      setStats(data.stats);
      setSalesData((data.salesData || []).map((point: SalesPoint) => ({ month: salesLabel(point), sales: point.sales })));
      setRecentOrders(data.recentOrders || []);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load your store overview."));
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "order:update" || event.key === "catalog:update") refresh();
    };
    window.addEventListener("order:itemUpdated", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("order:itemUpdated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);
  const cards = [
    { title: "Active products", value: stats?.totalProducts, icon: Package, path: "/admin/products", description: "Your live catalog" },
    {
      title: "Categories",
      value: stats?.totalCategories,
      icon: FolderTree,
      path: "/admin/categories",
      description: "Organized for discovery",
    },
    { title: "Total orders", value: stats?.totalOrders, icon: ShoppingBag, path: "/admin/orders", description: "Across all statuses" },
    { title: "Registered users", value: stats?.totalUsers, icon: Users, path: "/admin/users", description: "Your store community" },
  ];
  return (
    <div className="space-y-6">
      <PageHeading
        title="Your store, at a glance"
        description="A clear view of your catalog, customers and the orders that keep your store moving."
        action={
          <button
            disabled={isLoading}
            onClick={() => void load()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />
      {error && <ErrorNotice message={error} retry={load} />}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        {cards.map(({ title, value, icon: Icon, path, description }) => (
          <Link key={title} to={path} className={`${panelClass} group p-4 transition hover:border-teal-300 sm:p-5`}>
            <div className="mb-5 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-teal-600" />
            </div>
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">{isLoading ? "…" : (value?.toLocaleString() ?? "—")}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{title}</p>
            <p className="mt-1 hidden text-xs text-slate-400 sm:block">{description}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
        <section className="flex flex-col justify-between rounded-2xl bg-[#122a2c] p-6 text-white">
          <div>
            <div className="mb-6 flex items-center gap-2 text-sm text-teal-300">
              <Wallet className="h-5 w-5" />
              Paid revenue
            </div>
            <p className="break-words text-3xl font-bold tracking-tight">{isLoading ? "…" : stats ? formatCurrency(stats.revenue) : "—"}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">All-time paid orders, excluding cancellations.</p>
          </div>
          <Link
            to="/admin/orders"
            className="mt-8 flex min-h-11 items-center justify-between rounded-xl bg-white/10 px-4 text-sm font-medium hover:bg-white/15"
          >
            Manage orders
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
        <section className={`${panelClass} min-w-0 p-4 sm:p-6`}>
          <h2 className="text-base font-semibold">Sales over time</h2>
          <p className="mb-5 mt-1 text-xs text-slate-500">Paid order revenue · last 6 months</p>
          {isLoading ? (
            <EmptyState loading />
          ) : salesData.length === 0 ? (
            <EmptyState title="No sales to chart yet" description="Paid orders will appear here as your store grows." />
          ) : (
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData} margin={{ top: 8, right: 0, bottom: 0, left: -15 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e9eef0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(value: number) => (value >= 1000 ? `${value / 1000}k` : String(value))}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }}
                    cursor={{ fill: "#f0fdfa" }}
                  />
                  <Bar dataKey="sales" fill="#0f766e" radius={[5, 5, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-semibold">Recent orders</h2>
            <p className="mt-1 text-xs text-slate-500">The latest activity in your store</p>
          </div>
          <Link to="/admin/orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700">
            View all
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {isLoading ? (
          <EmptyState loading />
        ) : recentOrders.length === 0 ? (
          <EmptyState title="Your first order is on its way" description="New orders will appear here with their latest status." />
        ) : (
          <div className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <Link
                key={order._id}
                to={`/admin/orders?order=${order._id}`}
                className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-slate-50 sm:px-5"
              >
                <span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 sm:flex">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{order.user?.name || "Customer account unavailable"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    #{order._id.slice(-8).toUpperCase()} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-sm font-semibold">{formatCurrency(order.totalPrice)}</p>
                  <StatusBadge status={order.status} />
                </div>
                <ArrowUpRight className="hidden h-4 w-4 text-slate-400 sm:block" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
