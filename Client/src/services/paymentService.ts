import api from "./api";
import type { OrderItem, ShippingAddress } from "./orderService";
import type { ShippingMethod } from "../lib/commerce";

export type PaymentState = "paid" | "processing" | "requires_action" | "failed" | "canceled" | "refunded";

export interface PaymentOutcome {
  state: PaymentState;
  message?: string;
  order?: { _id: string; totalPrice: number };
}

export const paymentService = {
  getConfig: () => api.get<{ cardEnabled: boolean; currency: string }>("/payments/config"),
  createIntent: (data: { items: OrderItem[]; shippingAddress: ShippingAddress; shippingMethod: ShippingMethod; requestId: string }) =>
    api.post<{ clientSecret: string; paymentIntentId: string; breakdown: { totalPrice: number } }>("/payments/create-intent", data),
  /** Asks the server to verify the payment with Stripe. Non-2xx responses still carry a PaymentOutcome. */
  confirm: async (paymentIntentId: string): Promise<PaymentOutcome> => {
    try {
      const { data } = await api.post("/payments/confirm-order", { paymentIntentId });
      return data;
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.state) return data;
      throw err;
    }
  },
};

/** sessionStorage record written just before confirming a payment, so a redirect return can tidy the cart. */
export const PENDING_PAYMENT_KEY = "payment:pending";

/** Clears purchased items from the cart once the server has accepted the payment. */
export function clearPurchasedItems(paymentIntentId: string, removeItems: (ids: string[]) => void) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_PAYMENT_KEY) || "null");
    if (pending?.paymentIntentId !== paymentIntentId) return;
    if (pending.fromCart && Array.isArray(pending.productIds)) removeItems(pending.productIds);
    sessionStorage.removeItem(PENDING_PAYMENT_KEY);
    for (const path of ["/checkout", "/buy-now"]) {
      sessionStorage.removeItem(`checkout:${path}`);
      sessionStorage.removeItem(`checkout:request:${path}`);
    }
  } catch {
    /* storage unavailable */
  }
}
