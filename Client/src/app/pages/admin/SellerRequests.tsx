import { useCallback, useEffect, useState } from "react";
import { Check, X, Phone, Home, GraduationCap, Mail } from "lucide-react";
import { toast } from "sonner";
import { userService } from "../../../services/userService";
import { Button } from "../../components/Button";
import { PageHeading, ErrorNotice, EmptyState, panelClass, formatDate, errorMessage } from "./AdminUI";

interface SellerRequest {
  _id: string;
  name: string;
  email: string;
  sellerRequestedAt?: string;
  sellerRequestMessage?: string;
  sellerProfile?: { hostelNumber?: string; roomNumber?: string; courseYear?: string; mobileNumber?: string };
}

export default function SellerRequests() {
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await userService.getSellerRequests({ limit: 50 });
      setRequests(data.users || []);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load seller requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(request: SellerRequest, approve: boolean) {
    const who = request.name || request.email;
    if (!window.confirm(approve ? `Let ${who} list products in the store?` : `Decline ${who}'s request to sell?`)) return;
    setBusy(request._id);
    try {
      if (approve) await userService.approveSeller(request._id);
      else await userService.rejectSeller(request._id);
      setRequests((current) => current.filter((item) => item._id !== request._id));
      toast.success(approve ? `${who} can now sell` : "Request declined");
    } catch (err) {
      toast.error(errorMessage(err, "The request couldn't be updated."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Seller requests"
        description="People outside the IIITM domain who'd like to sell. Approve those you trust to list products."
      />
      {error && <ErrorNotice message={error} retry={load} />}
      {loading ? (
        <div className={panelClass}>
          <EmptyState loading />
        </div>
      ) : error ? null : requests.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title="You're all caught up" description="New seller requests will appear here." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {requests.map((request) => (
            <li key={request._id} className={`${panelClass} flex flex-col p-5`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{request.name || "Unnamed account"}</p>
                  <a href={`mailto:${request.email}`} className="mt-1 flex items-center gap-1.5 break-all text-sm text-teal-700">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {request.email}
                  </a>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(request.sellerRequestedAt)}</span>
              </div>
              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <dt className="sr-only">Mobile</dt>
                  <dd>{request.sellerProfile?.mobileNumber || "—"}</dd>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Home className="h-4 w-4 text-slate-400" />
                  <dt className="sr-only">Hostel and room</dt>
                  <dd>{[request.sellerProfile?.hostelNumber, request.sellerProfile?.roomNumber].filter(Boolean).join(" / ") || "—"}</dd>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <GraduationCap className="h-4 w-4 text-slate-400" />
                  <dt className="sr-only">Course year</dt>
                  <dd>{request.sellerProfile?.courseYear || "—"}</dd>
                </div>
              </dl>
              {request.sellerRequestMessage && (
                <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{request.sellerRequestMessage}</p>
              )}
              <div className="mt-auto flex gap-3">
                <Button className="flex-1" disabled={busy === request._id} onClick={() => void decide(request, true)}>
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  disabled={busy === request._id}
                  onClick={() => void decide(request, false)}
                >
                  <X className="h-4 w-4" />
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
