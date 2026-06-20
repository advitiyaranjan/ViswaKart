import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useCart } from "../../context/CartContext";
import { clearPurchasedItems, paymentService, type PaymentOutcome } from "../../services/paymentService";
import { OrderOutcome } from "../components/OrderOutcome";

const MAX_PROCESSING_CHECKS = 6;

/**
 * Stripe's return_url for payment methods that leave the site (bank authentication, wallets).
 * The query string is only a hint; the outcome always comes from the server, which asks Stripe.
 */
export default function PaymentComplete() {
  const [params] = useSearchParams();
  const { removeItems } = useCart();
  const paymentIntentId = params.get("payment_intent") || "";
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      setError("This payment link is incomplete. Check My Orders to see whether your order went through.");
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async (attempt: number) => {
      try {
        const result = await paymentService.confirm(paymentIntentId);
        if (!active) return;
        if (result.state === "paid" || result.state === "processing") clearPurchasedItems(paymentIntentId, removeItems);
        setOutcome(result);
        // Some methods settle a few seconds after the redirect; check again briefly before showing "processing".
        if (result.state === "processing" && attempt < MAX_PROCESSING_CHECKS) timer = setTimeout(() => void check(attempt + 1), 4000);
      } catch (err: any) {
        if (active) setError(err?.response?.data?.message || "We couldn't confirm your payment. If you were charged, your order will appear in My Orders shortly.");
      }
    };
    void check(1);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [paymentIntentId, removeItems]);

  if (error) return <OrderOutcome kind="failed" message={error} />;
  if (!outcome)
    return (
      <div role="status" className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="mt-5 text-muted-foreground">Confirming your payment with the bank…</p>
      </div>
    );
  return <OrderOutcome kind={outcome.state} order={outcome.order} message={outcome.message} />;
}
