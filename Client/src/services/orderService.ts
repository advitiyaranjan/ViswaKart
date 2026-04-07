import api from "./api";

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
  paymentMethod: "card" | "paypal" | "cod";
}

export const orderService = {
  createOrder: (data: CreateOrderData) =>
    api.post("/orders", data).then((res) => {
      try {
        const orderId = res?.data?.order?._id || res?.data?.order?.id;
        window.dispatchEvent(new CustomEvent("order:itemUpdated", { detail: { orderId } }));
        // broadcast to other tabs via localStorage to trigger storage event
        const key = "order:update";
        const payload = JSON.stringify({ orderId, ts: Date.now() });
        localStorage.setItem(key, payload);
        localStorage.removeItem(key);
      } catch (e) {}
      return res;
    }),
  getMyOrders: (params?: { page?: number; limit?: number }) =>
    api.get("/orders/my", { params }),
  getSellerOrders: (params?: { page?: number; limit?: number }) => api.get("/orders/seller/my", { params }),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  getAllOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get("/orders", { params }),
  updateOrderStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }).then((res) => {
      try {
        window.dispatchEvent(new CustomEvent("order:itemUpdated", { detail: { orderId: id } }));
        // broadcast to other tabs via localStorage to trigger storage event
        const key = "order:update";
        const payload = JSON.stringify({ orderId: id, ts: Date.now() });
        localStorage.setItem(key, payload);
        localStorage.removeItem(key);
      } catch (e) {}
      return res;
    }),
  updateOrderItemStatus: (orderId: string, itemId: string, status: string) =>
    api.put(`/orders/${orderId}/items/${itemId}/status`, { status }).then((res) => {
      try {
        window.dispatchEvent(new CustomEvent("order:itemUpdated", { detail: { orderId } }));
        // broadcast to other tabs via localStorage to trigger storage event
        const key = "order:update";
        const payload = JSON.stringify({ orderId, ts: Date.now() });
        localStorage.setItem(key, payload);
        localStorage.removeItem(key);
      } catch (e) {}
      return res;
    }),
  cancelOrder: (id: string) => api.put(`/orders/${id}/cancel`),
};
