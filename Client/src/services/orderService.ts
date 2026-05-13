import api from "./api";
import type { ShippingMethod } from "../lib/commerce";

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderItem {
  product: string;
  quantity: number;
}

export interface CreateOrderData {
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: "cod";
  shippingMethod?: ShippingMethod;
  expectedTotal?: number;
  requestId?: string;
}

/** Tells other open views (this tab and other tabs) that an order changed so they can refresh. */
function broadcastOrderChange(orderId?: string) {
  try {
    window.dispatchEvent(new CustomEvent("order:itemUpdated", { detail: { orderId } }));
    localStorage.setItem("order:update", JSON.stringify({ orderId, ts: Date.now() }));
    localStorage.removeItem("order:update");
  } catch {
    /* storage unavailable */
  }
}

function notifying<T extends { data?: { order?: { _id?: string } } }>(request: Promise<T>, orderId?: string) {
  return request.then((res) => {
    broadcastOrderChange(orderId ?? res?.data?.order?._id);
    return res;
  });
}

export const orderService = {
  quote: (data: { items: OrderItem[]; shippingMethod: ShippingMethod }) => api.post("/orders/quote", data),
  createOrder: (data: CreateOrderData) => notifying(api.post("/orders", data)),
  getMyOrders: (params?: { page?: number; limit?: number }) => api.get("/orders/my", { params }),
  getSellerOrders: (params?: { page?: number; limit?: number }) => api.get("/orders/seller/my", { params }),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  getAllOrders: (params?: { page?: number; limit?: number; status?: string; search?: string }) => api.get("/orders", { params }),
  updateOrderStatus: (id: string, status: string) => notifying(api.put(`/orders/${id}/status`, { status }), id),
  updateOrderItemStatus: (orderId: string, itemId: string, status: string) =>
    notifying(api.put(`/orders/${orderId}/items/${itemId}/status`, { status }), orderId),
  cancelOrder: (id: string) => notifying(api.put(`/orders/${id}/cancel`), id),
};
