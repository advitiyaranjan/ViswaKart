import { useState, useEffect, useCallback } from "react";
import { Truck, RefreshCw, MapPin } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/orderService";
import { formatCurrency } from "../../../lib/currency";
import { nextStatuses, shortOrderId } from "../../../lib/commerce";
import { ProductImage } from "../../components/ProductImage";

interface SellerItem {
  _id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  itemStatus?: string;
}

interface SellerOrder {
  _id: string;
  createdAt: string;
  user?: { name?: string; email?: string };
  shippingAddress?: { street: string; city: string; state: string; zipCode: string };
  items: SellerItem[];
}

/** Orders that include this seller's items. The API returns only the seller's own lines. */
export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    return orderService
      .getSellerOrders({ limit: 50 })
      .then((res) => setOrders(res.data.orders ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    const onStorage = (event: StorageEvent) => event.key === "order:update" && refresh();
    window.addEventListener("order:itemUpdated", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("order:itemUpdated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);

  async function changeStatus(orderId: string, item: SellerItem, status: string) {
    if (status === "Cancelled" && !window.confirm(`Cancel ${item.name} for this buyer? The stock will be returned to your listing.`))
      return;
    setUpdating(item._id);
    try {
      await orderService.updateOrderItemStatus(orderId, item._id, status);
      toast.success(`${item.name} marked as ${status.toLowerCase()}`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "The status couldn't be updated. Please try again.");
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 py-2" role="status" aria-label="Loading seller orders">
        {[1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-2">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
        <Truck className="h-4 w-4 text-primary" /> Orders for your items
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">Update each item as you hand it over. Buyers see these updates in their orders.</p>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          We couldn't load your seller orders.
          <button onClick={() => void load()} className="ml-2 inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No one has ordered your items yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const sellerTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return (
              <li key={order._id} className="overflow-hidden rounded-xl border border-border bg-white">
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Order</p>
                    <p className="font-mono text-sm font-medium">{shortOrderId(order._id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Buyer</p>
                    <p className="truncate text-sm font-medium">{order.user?.name || "Customer"}</p>
                    {order.user?.email && <p className="truncate text-xs text-muted-foreground">{order.user.email}</p>}
                  </div>
                  <div className="col-span-2 sm:col-span-1 sm:text-right">
                    <p className="text-xs text-muted-foreground">Your items</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(sellerTotal)}</p>
                  </div>
                </div>
                {order.shippingAddress && (
                  <p className="flex items-start gap-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                    {order.shippingAddress.zipCode}
                  </p>
                )}
                <ul className="space-y-3 border-t border-border bg-slate-50 p-4">
                  {order.items.map((item) => {
                    const status = item.itemStatus || "Pending";
                    const options = nextStatuses(status);
                    return (
                      <li key={item._id} className="flex flex-wrap items-center gap-3">
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
                        </div>
                        {options.length ? (
                          <select
                            aria-label={`Status for ${item.name}`}
                            value={status}
                            disabled={updating === item._id}
                            onChange={(event) => void changeStatus(order._id, item, event.target.value)}
                            className="min-h-11 rounded-lg border border-border bg-white px-3 text-sm"
                          >
                            <option value={status}>{status}</option>
                            {options.map((next) => (
                              <option key={next} value={next}>
                                {next === "Cancelled" ? "Cancel item" : `Mark ${next.toLowerCase()}`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">{status}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
