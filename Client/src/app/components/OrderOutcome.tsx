import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { formatCurrency } from "../../lib/currency";
import { shortOrderId } from "../../lib/commerce";
import type { PaymentState } from "../../services/paymentService";
import { buttonClass } from "./Button";

export type OutcomeKind = PaymentState | "cod";

interface Props {
  kind: OutcomeKind;
  order?: { _id: string; totalPrice: number };
  message?: string;
  /** Shown on failure screens; defaults to returning to the cart. */
  retryTo?: string;
}

const CONTENT: Record<OutcomeKind, { icon: typeof CheckCircle2; tone: string; title: string }> = {
  cod: { icon: CheckCircle2, tone: "text-primary bg-primary/10", title: "Order placed!" },
  paid: { icon: CheckCircle2, tone: "text-primary bg-primary/10", title: "Payment received. Order confirmed!" },
  processing: { icon: Clock3, tone: "text-amber-600 bg-amber-50", title: "Payment processing" },
  requires_action: { icon: Clock3, tone: "text-amber-600 bg-amber-50", title: "Payment not finished" },
  failed: { icon: XCircle, tone: "text-red-600 bg-red-50", title: "Payment failed" },
  canceled: { icon: XCircle, tone: "text-red-600 bg-red-50", title: "Payment cancelled" },
  refunded: { icon: RotateCcw, tone: "text-amber-600 bg-amber-50", title: "Payment refunded" },
};

/** Final screen of checkout for every payment outcome. */
export function OrderOutcome({ kind, order, message, retryTo = "/cart" }: Props) {
  const { icon: Icon, tone, title } = CONTENT[kind] ?? { icon: AlertTriangle, tone: "text-red-600 bg-red-50", title: "Something went wrong" };
  const success = kind === "paid" || kind === "cod";
  const body =
    message ||
    (kind === "cod" && order
      ? `Pay ${formatCurrency(order.totalPrice)} in cash when it arrives. You can follow its progress in My Orders.`
      : kind === "paid" && order
        ? `We've received ${formatCurrency(order.totalPrice)}. A confirmation email is on its way.`
        : "");
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-3xl border border-border bg-white p-7 text-center sm:p-10" role={success ? "status" : "alert"}>
        <span className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-9 w-9" />
        </span>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {body && <p className="mt-3 text-muted-foreground">{body}</p>}
        {order && <p className="my-6 break-all rounded-xl bg-muted p-3 font-mono text-sm">Order {shortOrderId(order._id)}</p>}
        <div className="mt-6 flex flex-col gap-3">
          {success || kind === "processing" ? (
            <Link to="/account#/orders" className={buttonClass("primary", "lg", "w-full")}>
              {kind === "processing" ? "View my orders" : "Track my order"}
            </Link>
          ) : (
            <Link to={retryTo} className={buttonClass("primary", "lg", "w-full")}>
              {kind === "refunded" ? "Back to my cart" : "Try again"}
            </Link>
          )}
          <Link className="font-medium text-primary" to="/products">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
