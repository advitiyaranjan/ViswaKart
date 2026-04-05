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
  createOrder: (data: CreateOrderData) => api.post("/orders", data),
  getMyOrders: (params?: { page?: number; limit?: number }) =>
    api.get("/orders/my", { params }),
  getOrder: (id: string) => api.get(`/orders/${id}`),
  getAllOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get("/orders", { params }),
  updateOrderStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
  cancelOrder: (id: string) => api.put(`/orders/${id}/cancel`),
};
