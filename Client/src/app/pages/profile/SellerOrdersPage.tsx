import React, { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Truck, Package, CheckCircle2, Clock, XCircle } from "lucide-react";
import { orderService } from "../../../services/orderService";
import { formatCurrency } from "../../../lib/currency";
import { useAuth } from "../../../context/AuthContext";

const STATUS_OPTIONS = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"] as const;

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    orderService
      .getSellerOrders({ limit: 50 })
      .then((res) => setOrders(res.data.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Refresh when any order item update occurs in this session
  useEffect(() => {
    const handler = (e: any) => {
      orderService
        .getSellerOrders({ limit: 50 })
        .then((res) => setOrders(res.data.orders ?? []))
        .catch(() => {});
    };
    window.addEventListener("order:itemUpdated", handler as EventListener);
    const storageHandler = (ev: StorageEvent) => {
      if (ev.key === "order:update") {
        orderService
          .getSellerOrders({ limit: 50 })
          .then((res) => setOrders(res.data.orders ?? []))
          .catch(() => {});
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("order:itemUpdated", handler as EventListener);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  // Re-fetch when Clerk sign-in status changes (ensure server-side session exists)
  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    orderService
      .getSellerOrders({ limit: 50 })
      .then((res) => setOrders(res.data.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const canEditItem = (item: any) => {
    // Match only this seller's own items so pricing stays consistent with the order-item snapshots.
    if (!user) return false;
    const myEmail = (user.email || "").toLowerCase();
    const myName = String(user.name || "").trim();
    return (item.sellerEmail && String(item.sellerEmail).toLowerCase() === myEmail) || (item.sellerName && String(item.sellerName).trim() === myName);
  };

  const handleChangeStatus = async (orderId: string, itemId: string, status: string) => {
    setUpdating((s) => ({ ...s, [itemId]: true }));
    try {
      await orderService.updateOrderItemStatus(orderId, itemId, status);
      // update local state
      setOrders((prev) => prev.map((o) => {
        if (String(o._id) !== String(orderId)) return o;
        return {
          ...o,
          items: o.items.map((it: any) => it._id === itemId ? { ...it, itemStatus: status } : it),
        };
      }));
    } catch (err) {
      const statusCode = err?.response?.status;
      if (statusCode === 401) {
        openSignIn();
      } else {
        alert("Failed to update item status. Try again.");
      }
    } finally {
      setUpdating((s) => ({ ...s, [itemId]: false }));
    }
  };

  if (loading) return <div className="py-4">Loading seller orders…</div>;

  if (orders.length === 0) return <div className="py-4 text-muted-foreground">No orders containing your items yet.</div>;

  return (
    <div className="py-2">
      <h2 className="font-bold text-base mb-4 flex items-center gap-2">
        <Truck className="w-4 h-4 text-primary" /> Seller Orders
      </h2>

      <div className="space-y-3">
        {orders.map((order) => {
          const sellerItems = (order.items || []).filter((item: any) => canEditItem(item));
          if (sellerItems.length === 0) return null;
          const sellerTotal = sellerItems.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

          return (
            <div key={order._id} className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 bg-white flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Order ID</p>
                  <p className="font-mono text-sm font-medium">#{String(order._id).slice(-8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Buyer</p>
                  <p className="text-sm font-medium">{order.user?.name || order.user?.email || 'Customer'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Your Items Total</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(sellerTotal)}</p>
                </div>
              </div>

              <div className="border-t border-border p-4 bg-slate-50 space-y-3">
                {sellerItems.map((item: any) => (
                  <div key={item._id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-border flex-shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      <p className="text-xs text-muted-foreground mt-1">Seller: {item.sellerName || item.sellerEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</p>
                      {canEditItem(item) ? (
                        !isSignedIn ? (
                          <button onClick={() => openSignIn()} className="mt-2 px-2 py-1 text-sm border rounded-lg bg-yellow-50">Sign in to update</button>
                        ) : (
                          <select
                            value={item.itemStatus || 'Pending'}
                            onChange={(e) => handleChangeStatus(order._id, item._id, e.target.value)}
                            disabled={!!updating[item._id]}
                            className="mt-2 px-2 py-1 text-sm border rounded-lg"
                          >
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">Status: <span className="font-medium">{item.itemStatus || 'Pending'}</span></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
