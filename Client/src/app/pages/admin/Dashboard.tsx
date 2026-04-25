import { TrendingUp, Package, FolderTree, ShoppingBag, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { userService } from "../../../services/userService";
import { Link } from "react-router";
import { formatCurrency } from "../../../lib/currency";

interface Stats {
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  totalUsers: number;
  revenue: number;
}

interface SalesPoint { _id: number; sales: number; }

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [salesData, setSalesData] = useState<{ month: string; sales: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    userService
      .getDashboardStats()
      .then((res) => {
        setStats(res.data.stats);
        const mapped = (res.data.salesData as SalesPoint[]).map((d) => ({
          month: MONTHS[d._id - 1] || String(d._id),
          sales: d.sales,
        }));
        setSalesData(mapped);
        setRecentOrders(res.data.recentOrders);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const statCards = [
    { title: "Total Products", value: stats?.totalProducts ?? "—", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Categories", value: stats?.totalCategories ?? "—", icon: FolderTree, color: "text-teal-600", bg: "bg-teal-50" },
    { title: "Orders", value: stats?.totalOrders ?? "—", icon: ShoppingBag, color: "text-green-600", bg: "bg-green-50" },
    { title: "Users", value: stats?.totalUsers.toLocaleString() ?? "—", icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your business overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${stat.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.title}</div>
            </div>
          );
        })}
      </div>

      {/* Revenue & Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Total Revenue</h2>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-4xl font-bold mb-2">
            {stats?.revenue !== undefined && stats?.revenue !== null ? formatCurrency(stats.revenue) : "—"}
          </div>
          <p className="text-sm text-muted-foreground">All-time revenue (excl. cancelled)</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/admin/products" className="p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left">
              <Package className="w-6 h-6 text-primary mb-2" />
              <div className="font-medium">Products</div>
            </Link>
            <Link to="/admin/categories" className="p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left">
              <FolderTree className="w-6 h-6 text-primary mb-2" />
              <div className="font-medium">Categories</div>
            </Link>
            <Link to="/admin/orders" className="p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left">
              <ShoppingBag className="w-6 h-6 text-primary mb-2" />
              <div className="font-medium">Orders</div>
            </Link>
            <Link to="/admin/users" className="p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left">
              <Users className="w-6 h-6 text-primary mb-2" />
              <div className="font-medium">Users</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-6">Sales Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="sales" fill="#6366f1" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Total</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentOrders as Record<string, unknown>[]).map((order) => (
                <tr key={order._id as string} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{(order._id as string).slice(-8)}</td>
                  <td className="px-6 py-4">{(order.user as Record<string,string>)?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(order.createdAt as string).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(order.totalPrice as number)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        order.status === "Delivered"
                          ? "bg-green-100 text-green-700"
                          : order.status === "Shipped"
                          ? "bg-blue-100 text-blue-700"
                          : order.status === "Processing"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {order.status as string}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
