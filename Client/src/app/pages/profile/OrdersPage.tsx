import { useState, useEffect, useCallback, type ReactElement } from "react";
import { ShoppingBag, Package, Truck, CheckCircle2, Clock, XCircle, ChevronDown, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/orderService";
import { formatCurrency } from "../../../lib/currency";
import { DELIVERY_OPTIONS, isCancellable, shortOrderId } from "../../../lib/commerce";
import { ProductImage } from "../../components/ProductImage";
import { Button } from "../../components/Button";

interface OrderItem {
  _id: string;
  product: string | { _id: string };
  name: string;
  image: string;
  price: number;
  quantity: number;
  itemStatus?: string;
}

interface Order {
  _id: string;
  items: OrderItem[];
  shippingAddress: { street: string; city: string; state: string; zipCode: string; country: string };
  paymentMethod: string;
  shippingMethod?: string;
  totalPrice: number;
  itemsPrice: number;
  shippingPrice: number;
  status: string;
  isPaid?: boolean;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: ReactElement; className: string }> = {
  Pending: { icon: <Clock className="h-3.5 w-3.5" />, className: "border-amber-200 bg-amber-50 text-amber-700" },
  Processing: { icon: <Package className="h-3.5 w-3.5" />, className: "border-blue-200 bg-blue-50 text-blue-700" },
  Shipped: { icon: <Truck className="h-3.5 w-3.5" />, className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  Delivered: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "border-green-200 bg-green-50 text-green-700" },
  Cancelled: { icon: <XCircle className="h-3.5 w-3.5" />, className: "border-red-200 bg-red-50 text-red-700" },
};

function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.icon}
      {status}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    return orderService
      .getMyOrders({ limit: 50 })
      .then((res) => setOrders(res.data.orders ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
    // Refresh when an order changes in this tab or another one.
    const refresh = () => void load();
    const onStorage = (event: StorageEvent) => event.key === "order:update" && refresh();
    window.addEventListener("order:itemUpdated", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("order:itemUpdated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);

  async function cancel(order: Order) {
    if (!window.confirm(`Cancel order ${shortOrderId(order._id)}? Items that haven't shipped will be cancelled.`)) return;
    setCancelling(order._id);
    try {
      await orderService.cancelOrder(order._id);
      toast.success("Your order was cancelled");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "The order couldn't be cancelled. Please try again.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="py-2">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
        <ShoppingBag className="h-4 w-4 text-primary" /> My orders
      </h2>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading orders">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          We couldn't load your orders.
          <button onClick={() => void load()} className="ml-2 inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No orders yet</p>
          <p className="mt-1 text-sm">Your order history will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const expanded = expandedOrder === order._id;
            const mixedStatuses = new Set(order.items.map((item) => item.itemStatus || order.status)).size > 1;
            const delivery = DELIVERY_OPTIONS.find((option) => option.id === order.shippingMethod);
            const shipped = order.status === "Shipped" || order.status === "Delivered";
            return (
              <li key={order._id} className="overflow-hidden rounded-xl border border-border bg-white">
                <button
                  onClick={() => setExpandedOrder(expanded ? null : order._id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Order</p>
                      <p className="font-mono text-sm font-medium">{shortOrderId(order._id)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(order.totalPrice)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Placed</p>
                      <p className="text-sm font-medium">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Items</p>
                      <p className="text-sm font-medium">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={order.status} />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-border bg-slate-50/50 p-4">
                    <ul className="space-y-3">
                      {order.items.map((item) => (
                        <li key={item._id} className="flex items-center gap-3">
                          <ProductImage
                            src={item.image}
                            alt={item.name}
                            className="h-12 w-12 shrink-0 rounded-lg border border-border bg-white object-contain p-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} × {formatCurrency(item.price)}
                            </p>
                            {mixedStatuses && item.itemStatus && (
                              <div className="mt-1">
                                <StatusPill status={item.itemStatus} />
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                        </li>
                      ))}
                    </ul>

                    <dl className="space-y-1.5 rounded-lg border border-border bg-white p-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <dt>Subtotal</dt>
                        <dd>{formatCurrency(order.itemsPrice)}</dd>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <dt>{delivery ? delivery.label : "Delivery"}</dt>
                        <dd>{order.shippingPrice === 0 ? "Free" : formatCurrency(order.shippingPrice)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1.5 font-bold">
                        <dt>Total</dt>
                        <dd className="text-primary">{formatCurrency(order.totalPrice)}</dd>
                      </div>
                    </dl>

                    <div className="text-sm text-muted-foreground">
                      <p className="mb-0.5 flex items-center gap-1.5 font-medium text-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {shipped ? "Shipped to" : "Delivering to"}
                      </p>
                      <p>
                        {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                        {order.shippingAddress.zipCode}, {order.shippingAddress.country}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {order.paymentMethod === "cod" ? "Cash on delivery" : "Paid by card"} ·{" "}
                        {order.isPaid ? "Paid" : "Payment due on delivery"}
                      </p>
                      {isCancellable(order.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cancelling === order._id}
                          onClick={() => void cancel(order)}
                          className="text-destructive hover:bg-red-50"
                        >
                          {cancelling === order._id ? "Cancelling…" : "Cancel order"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
