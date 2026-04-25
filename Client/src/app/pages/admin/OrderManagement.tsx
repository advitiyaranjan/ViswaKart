import { useState, useEffect } from "react";
import { Search, Eye } from "lucide-react";
import { orderService } from "../../../services/orderService";
import { Link } from "react-router";
import { formatCurrency } from "../../../lib/currency";

interface Order {
  _id: string;
  user?: { name: string };
  createdAt: string;
  totalPrice: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Shipped: "bg-blue-100 text-blue-700 border-blue-200",
  Processing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Pending: "bg-gray-100 text-gray-700 border-gray-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    orderService.getAllOrders().then((res) => {
      setOrders(res.data.orders);
    }).finally(() => setIsLoading(false));
  }, []);

  // Refresh when any order update occurs (seller changed item status or admin changed order status)
  useEffect(() => {
    const handler = (e: any) => {
      setIsLoading(true);
      orderService.getAllOrders().then((res) => setOrders(res.data.orders)).catch(() => {}).finally(() => setIsLoading(false));
    };
    window.addEventListener("order:itemUpdated", handler as EventListener);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === "order:update") {
        setIsLoading(true);
        orderService.getAllOrders().then((res) => setOrders(res.data.orders)).catch(() => {}).finally(() => setIsLoading(false));
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("order:itemUpdated", handler as EventListener);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const handleStatusChange = async (orderId: string, status: string) => {
    await orderService.updateOrderStatus(orderId, status);
    setOrders((prev) => prev.map((o) => o._id === orderId ? { ...o, status } : o));
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order._id.includes(searchQuery) ||
      (order.user?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Order Management</h1>
        <p className="text-muted-foreground">Track and manage customer orders</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Total</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filteredOrders.map((order) => (
                <tr key={order._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">{order._id.slice(-8)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {(order.user?.name || "?").charAt(0)}
                      </div>
                      <span>{order.user?.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(order.totalPrice)}</td>
                  <td className="px-6 py-4">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border-2 focus:outline-none focus:ring-2 focus:ring-ring ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}
                    >
                      <option>Pending</option>
                      <option>Processing</option>
                      <option>Shipped</option>
                      <option>Delivered</option>
                      <option>Cancelled</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/orders/${order._id}`} className="p-2 hover:bg-accent rounded-lg transition-colors block w-fit">
                      <Eye className="w-4 h-4" />
                    </Link>
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


