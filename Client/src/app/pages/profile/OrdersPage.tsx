import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { orderService } from "../../../services/orderService";

interface OrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  items: OrderItem[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentMethod: string;
  totalPrice: number;
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactElement; color: string; bg: string }> = {
  Pending:    { icon: <Clock className="w-4 h-4" />,        color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  Processing: { icon: <Package className="w-4 h-4" />,      color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  Shipped:    { icon: <Truck className="w-4 h-4" />,         color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  Delivered:  { icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600",  bg: "bg-green-50 border-green-200" },
  Cancelled:  { icon: <XCircle className="w-4 h-4" />,      color: "text-red-600",    bg: "bg-red-50 border-red-200" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    orderService
      .getMyOrders({ limit: 50 })
      .then((res) => setOrders(res.data.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-2">
      <h2 className="font-bold text-base mb-4 flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-primary" /> Previous Orders
      </h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders yet</p>
          <p className="text-sm mt-1">Your order history will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.Pending;
            const expanded = expandedOrder === order._id;
            const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <div key={order._id} className="rounded-xl border border-border overflow-hidden">
                {/* Order header */}
                <button
                  onClick={() => setExpandedOrder(expanded ? null : order._id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Order ID</p>
                      <p className="font-mono text-sm font-medium">#{order._id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{orderDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Items</p>
                      <p className="text-sm font-medium">{order.items.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-bold text-primary">${order.totalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}
                    >
                      {cfg.icon} {order.status}
                    </span>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-border p-4 bg-slate-50/50 space-y-4">
                    {/* Items */}
                    <div className="space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-border flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Price breakdown */}
                    <div className="rounded-lg bg-white border border-border p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>${order.itemsPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Shipping</span>
                        <span>{order.shippingPrice === 0 ? "Free" : `$${order.shippingPrice.toFixed(2)}`}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax</span>
                        <span>${order.taxPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-border pt-1.5">
                        <span>Total</span>
                        <span className="text-primary">${order.totalPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Shipping address */}
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-0.5 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" /> Shipped to
                      </p>
                      <p>
                        {order.shippingAddress.street}, {order.shippingAddress.city},{" "}
                        {order.shippingAddress.state} {order.shippingAddress.zipCode},{" "}
                        {order.shippingAddress.country}
                      </p>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Payment:{" "}
                      <span className="capitalize font-medium text-foreground">{order.paymentMethod}</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
