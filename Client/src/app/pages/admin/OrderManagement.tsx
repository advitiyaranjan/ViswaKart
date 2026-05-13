import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { Search, ChevronRight, ShoppingBag, MapPin, Banknote, Store } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/orderService";
import { formatCurrency } from "../../../lib/currency";
import { DELIVERY_OPTIONS, ORDER_STATUSES, nextStatuses, shortOrderId } from "../../../lib/commerce";
import { ProductImage } from "../../components/ProductImage";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "../../components/ui/sheet";
import { PageHeading, ErrorNotice, EmptyState, Pagination, StatusBadge, inputClass, panelClass, formatDate, errorMessage } from "./AdminUI";

interface OrderSummary {
  _id: string;
  user?: { name: string; email?: string };
  createdAt: string;
  totalPrice: number;
  status: string;
  isPaid?: boolean;
  items?: { quantity: number }[];
}

interface OrderDetail extends OrderSummary {
  items: {
    _id: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
    itemStatus: string;
    sellerName?: string;
    sellerEmail?: string;
    sellerMobile?: string;
    sellerHostelNumber?: string;
    sellerRoomNumber?: string;
  }[];
  shippingAddress: { street: string; city: string; state: string; zipCode: string; country: string };
  shippingMethod?: string;
  paymentMethod: string;
  itemsPrice: number;
  shippingPrice: number;
  paidAt?: string;
  deliveredAt?: string;
}

const PAGE_SIZE = 20;

function StatusSelect({
  status,
  disabled,
  label,
  onChange,
}: {
  status: string;
  disabled?: boolean;
  label: string;
  onChange: (next: string) => void;
}) {
  const options = nextStatuses(status);
  if (!options.length) return <StatusBadge status={status} />;
  return (
    <select
      aria-label={label}
      value={status}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} !text-sm disabled:bg-slate-50 disabled:text-slate-500`}
    >
      <option value={status}>{status}</option>
      {options.map((value) => (
        <option key={value} value={value}>
          {value === "Cancelled" ? "Cancel" : `Mark ${value.toLowerCase()}`}
        </option>
      ))}
    </select>
  );
}

export default function OrderManagement() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("order"));
  const [detailError, setDetailError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError("");
    try {
      const { data } = await orderService.getAllOrders({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        search: search.trim() || undefined,
      });
      if (id !== requestId.current) return;
      setOrders(data.orders || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err, "We couldn't load orders."));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [page, status, search]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailError("");
    try {
      const { data } = await orderService.getOrder(id);
      setDetail(data.order);
    } catch (err) {
      setDetailError(errorMessage(err, "This order couldn't be loaded."));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    void loadDetail(detailId);
  }, [detailId, loadDetail]);

  useEffect(() => {
    const refresh = () => void load();
    const onStorage = (event: StorageEvent) => event.key === "order:update" && refresh();
    window.addEventListener("order:itemUpdated", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("order:itemUpdated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [load]);

  async function updateOrder(order: { _id: string }, next: string) {
    if (
      next === "Cancelled" &&
      !window.confirm(`Cancel order ${shortOrderId(order._id)}? Items that haven't shipped are cancelled and their stock is returned.`)
    )
      return;
    setUpdating(order._id);
    try {
      await orderService.updateOrderStatus(order._id, next);
      toast.success(`Order ${shortOrderId(order._id)} updated`);
      await load();
      if (detailId === order._id) await loadDetail(order._id);
    } catch (err) {
      toast.error(errorMessage(err, "The order could not be updated."));
    } finally {
      setUpdating(null);
    }
  }

  async function updateItem(orderId: string, itemId: string, name: string, next: string) {
    if (next === "Cancelled" && !window.confirm(`Cancel “${name}” in this order? Its stock will be returned.`)) return;
    setUpdating(itemId);
    try {
      await orderService.updateOrderItemStatus(orderId, itemId, next);
      toast.success(`${name} updated`);
      await Promise.all([load(), loadDetail(orderId)]);
    } catch (err) {
      toast.error(errorMessage(err, "The item could not be updated."));
    } finally {
      setUpdating(null);
    }
  }

  const delivery = DELIVERY_OPTIONS.find((option) => option.id === detail?.shippingMethod);
  const itemCount = (order: OrderSummary) => order.items?.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Orders"
        description="Keep fulfillment moving. Open an order to see its items, address and payment, or update its progress right from the list."
      />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Filter by status">
        {["", ...ORDER_STATUSES].map((value) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${status === value ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"}`}
          >
            {value || "All orders"}
          </button>
        ))}
      </div>

      <div className={`${panelClass} p-4`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            aria-label="Search orders"
            type="search"
            placeholder="Order ID, customer name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} pl-10`}
          />
        </div>
      </div>

      {error && <ErrorNotice message={error} retry={load} />}

      <section className={`${panelClass} overflow-hidden`}>
        {isLoading ? (
          <EmptyState loading />
        ) : error ? null : orders.length === 0 ? (
          <EmptyState
            title="No orders found"
            description={
              search || status ? "Try another search or change the status filter." : "Customer orders will appear here once placed."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {orders.map((order) => (
                <li key={order._id} className="space-y-3 p-4">
                  <button
                    type="button"
                    onClick={() => setDetailId(order._id)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                        {shortOrderId(order._id)}
                        <ChevronRight className="h-4 w-4" />
                      </p>
                      <p className="truncate text-sm font-medium">{order.user?.name || "Customer account unavailable"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(order.createdAt)} · {order.isPaid ? "Paid" : "Payment pending"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold">{formatCurrency(order.totalPrice)}</p>
                      <div className="mt-1">
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  </button>
                  <StatusSelect
                    status={order.status}
                    disabled={updating === order._id}
                    label={`Update order ${shortOrderId(order._id)}`}
                    onChange={(next) => void updateOrder(order, next)}
                  />
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {["Order", "Customer", "Total / payment", "Status", ""].map((heading) => (
                      <th key={heading} className="px-5 py-4 text-left font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{shortOrderId(order._id)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(order.createdAt)}
                          {itemCount(order) ? ` · ${itemCount(order)} item${itemCount(order) === 1 ? "" : "s"}` : ""}
                        </p>
                      </td>
                      <td className="max-w-56 px-5 py-4">
                        <p className="truncate font-medium">{order.user?.name || "Customer account unavailable"}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{order.user?.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{formatCurrency(order.totalPrice)}</p>
                        <p className={`mt-1 text-xs ${order.isPaid ? "text-teal-700" : "text-amber-700"}`}>
                          {order.isPaid ? "Paid" : "Payment pending"}
                        </p>
                      </td>
                      <td className="w-48 px-5 py-4">
                        <StatusSelect
                          status={order.status}
                          disabled={updating === order._id}
                          label={`Update order ${shortOrderId(order._id)}`}
                          onChange={(next) => void updateOrder(order, next)}
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailId(order._id)}
                          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          Details
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!error && <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} loading={isLoading} />}
      </section>

      <p className="flex items-center gap-2 text-xs leading-relaxed text-slate-500">
        <ShoppingBag className="h-4 w-4 shrink-0" />
        Delivered and cancelled orders are final. Cash-on-delivery orders are marked paid once delivered.
      </p>

      <Sheet open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-white p-0 sm:max-w-lg">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4 pr-14">
            <SheetTitle className="text-lg">{detailId ? `Order ${shortOrderId(detailId)}` : "Order"}</SheetTitle>
            <SheetDescription>
              {detail ? `Placed ${formatDate(detail.createdAt)} by ${detail.user?.name || "a customer"}` : "Loading order details…"}
            </SheetDescription>
          </div>
          {detailError ? (
            <div className="p-5">
              <ErrorNotice message={detailError} retry={() => detailId && void loadDetail(detailId)} />
            </div>
          ) : !detail || detail._id !== detailId ? (
            <EmptyState loading />
          ) : (
            <div className="space-y-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={detail.status} />
                <div className="w-48">
                  <StatusSelect
                    status={detail.status}
                    disabled={updating === detail._id}
                    label="Update whole order"
                    onChange={(next) => void updateOrder(detail, next)}
                  />
                </div>
              </div>

              <section>
                <h3 className="mb-3 text-sm font-semibold">Items</h3>
                <ul className="space-y-4">
                  {detail.items.map((item) => (
                    <li key={item._id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex gap-3">
                        <ProductImage
                          src={item.image}
                          alt={item.name}
                          className="h-14 w-14 shrink-0 rounded-lg bg-slate-50 object-contain p-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.quantity} × {formatCurrency(item.price)} ={" "}
                            <span className="font-semibold text-slate-700">{formatCurrency(item.price * item.quantity)}</span>
                          </p>
                          {(item.sellerName || item.sellerEmail) && (
                            <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                              <Store className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>
                                {item.sellerName || item.sellerEmail}
                                {item.sellerHostelNumber &&
                                  ` · ${item.sellerHostelNumber}${item.sellerRoomNumber ? `/${item.sellerRoomNumber}` : ""}`}
                                {item.sellerMobile && ` · ${item.sellerMobile}`}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <StatusSelect
                          status={item.itemStatus}
                          disabled={updating === item._id}
                          label={`Update ${item.name}`}
                          onChange={(next) => void updateItem(detail._id, item._id, item.name, next)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd>{formatCurrency(detail.itemsPrice)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">{delivery?.label ?? "Delivery"}</dt>
                  <dd>{detail.shippingPrice ? formatCurrency(detail.shippingPrice) : "Free"}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                  <dt>Total</dt>
                  <dd>{formatCurrency(detail.totalPrice)}</dd>
                </div>
              </dl>

              <section className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-teal-700" /> Deliver to
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {detail.user?.name && (
                      <>
                        {detail.user.name}
                        <br />
                      </>
                    )}
                    {detail.shippingAddress.street}
                    <br />
                    {detail.shippingAddress.city}, {detail.shippingAddress.state} {detail.shippingAddress.zipCode}
                    <br />
                    {detail.shippingAddress.country}
                  </p>
                  {detail.user?.email && (
                    <a href={`mailto:${detail.user.email}`} className="mt-1 block break-all text-sm text-teal-700">
                      {detail.user.email}
                    </a>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Banknote className="h-4 w-4 text-teal-700" /> Payment
                  </h3>
                  <p className="text-sm text-slate-600">{detail.paymentMethod === "cod" ? "Cash on delivery" : "Card"}</p>
                  <p className={`text-sm font-medium ${detail.isPaid ? "text-teal-700" : "text-amber-700"}`}>
                    {detail.isPaid ? `Paid ${formatDate(detail.paidAt)}` : "Not yet paid"}
                  </p>
                  {detail.deliveredAt && <p className="mt-1 text-xs text-slate-500">Delivered {formatDate(detail.deliveredAt)}</p>}
                </div>
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
