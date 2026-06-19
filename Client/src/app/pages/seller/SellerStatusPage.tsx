import { Link } from "react-router";
import { Ban, Clock3, Mail, RefreshCw, XCircle } from "lucide-react";
import { SELL_PATHS, type SellerSummary } from "../../../lib/seller";
import { Button, buttonClass } from "../../components/Button";
import SellerOrdersPage from "../profile/SellerOrdersPage";
import { SellerGate, SellerPageFrame } from "./SellerShell";

const SUPPORT_EMAIL = "advitiyaranjan1@gmail.com";

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

function Details({ seller }: { seller: SellerSummary }) {
  const rows = [
    ["Name", seller.profile.name],
    ["Mobile", seller.profile.mobileNumber],
    ["Pickup", [seller.profile.hostelNumber, seller.profile.roomNumber].filter(Boolean).join(", room ")],
    ["Course", seller.profile.courseYear],
    ["College", seller.college?.name ?? ""],
  ].filter(([, value]) => value);
  if (!rows.length) return null;
  return (
    <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusView({ seller, reload }: { seller: SellerSummary; reload: () => void }) {
  if (seller.status === "pending") {
    return (
      <SellerPageFrame title="Application under review" description="Thanks for applying. We'll let you list products as soon as an admin approves your application.">
        <section className="rounded-2xl border border-border bg-white p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Clock3 className="h-6 w-6" />
            </span>
            <div>
              <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Pending approval</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Submitted {formatDate(seller.requestedAt) ?? "recently"}. Most applications are reviewed within a day.
              </p>
            </div>
          </div>
          <Details seller={seller} />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
              Check again
            </Button>
            <Link to="/products" className={buttonClass("ghost")}>
              Keep shopping
            </Link>
          </div>
        </section>
      </SellerPageFrame>
    );
  }

  if (seller.status === "rejected") {
    return (
      <SellerPageFrame title="Application not approved" description="You can update your details and apply again.">
        <section className="rounded-2xl border border-border bg-white p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <XCircle className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Reason from our team</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{seller.reason || "No reason was given."}</p>
              {seller.reviewedAt && <p className="mt-2 text-xs text-muted-foreground">Reviewed {formatDate(seller.reviewedAt)}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={SELL_PATHS.register} className={buttonClass()}>
              Update and resubmit
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Seller application")}`} className={buttonClass("outline")}>
              <Mail className="h-4 w-4" />
              Contact support
            </a>
          </div>
        </section>
      </SellerPageFrame>
    );
  }

  // Suspended: no new listings, but open orders must still be fulfilled.
  return (
    <SellerPageFrame title="Seller account suspended" description="You can't list or edit products right now. Your existing orders are unaffected.">
      <section className="rounded-2xl border border-red-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <Ban className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Reason</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{seller.reason || "No reason was given."}</p>
            <p className="mt-3 text-sm">If you think this is a mistake, contact us and we'll review it.</p>
          </div>
        </div>
        <a className={buttonClass("outline", "md", "mt-6")} href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Seller account suspension")}`}>
          <Mail className="h-4 w-4" />
          Contact support
        </a>
      </section>
      <section className="mt-6 rounded-2xl border border-border bg-white p-5 sm:p-6">
        <SellerOrdersPage />
      </section>
    </SellerPageFrame>
  );
}

export default function SellerStatusPage() {
  return <SellerGate path={SELL_PATHS.status}>{({ seller, reload }) => <StatusView seller={seller} reload={reload} />}</SellerGate>;
}
