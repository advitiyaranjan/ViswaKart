import { useState, type FormEvent } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { PENDING_PAYMENT_KEY, paymentService, type PaymentOutcome } from "../../services/paymentService";
import { formatCurrency } from "../../lib/currency";
import { Button } from "./Button";

// Loaded once, and only when a shopper chooses to pay by card (this module itself is lazy-loaded).
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  stripePromise ||= loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);
  return stripePromise;
}

interface Props {
  clientSecret: string;
  amount: number;
  /** Saved before confirming so the return page (after a bank redirect) can tidy up the cart. */
  pending: { paymentIntentId: string; productIds: string[]; fromCart: boolean };
  onOutcome: (outcome: PaymentOutcome) => void;
}

function PayForm({ amount, pending, onOutcome }: Omit<Props, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setError("");
    try {
      try {
        sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
      } catch {
        /* optional: only used to clean up the cart after a redirect */
      }
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/payment/complete` },
        // Cards finish here; methods that need a bank page come back via /payment/complete.
        redirect: "if_required",
      });
      if (stripeError) {
        // Card declines and validation problems: the customer can correct and retry. Nothing was charged.
        setError(stripeError.message || "Your payment couldn't be completed. Please try again.");
        return;
      }
      // The browser's word isn't enough: the server checks the PaymentIntent with Stripe before creating the order.
      onOutcome(await paymentService.confirm(paymentIntent!.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || "We couldn't confirm your payment. If you were charged, your order will appear in My Orders shortly.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setReady(true)} />
      {!ready && (
        <div role="status" className="space-y-3">
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
          </div>
          <span className="sr-only">Loading secure payment form…</span>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || !ready || paying}>
        <Lock className="h-4 w-4" />
        {paying ? "Processing payment…" : `Pay ${formatCurrency(amount)}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Payments are processed securely by Stripe. We never see your card details.</p>
    </form>
  );
}

export default function StripePayment({ clientSecret, ...props }: Props) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#0f766e", borderRadius: "12px", fontFamily: "inherit" } },
      }}
    >
      <PayForm {...props} />
    </Elements>
  );
}
