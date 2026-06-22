import { useCallback, useEffect, useState } from "react";
import { Check, X, Phone, Home, GraduationCap, Mail, Ban, RotateCcw, School } from "lucide-react";
import { toast } from "sonner";
import { userService } from "../../../services/userService";
import type { SellerStatus } from "../../../lib/seller";
import { Button } from "../../components/Button";
import { PageHeading, ErrorNotice, EmptyState, panelClass, formatDate, errorMessage, inputClass } from "./AdminUI";
import { CollegeList } from "../../components/college/CollegeList";
import { collegeService } from "../../../services/collegeService";
import type { College } from "../../../lib/college";

type Filter = Exclude<SellerStatus, "none">;

interface SellerAccount {
  _id: string;
  name: string;
  email: string;
  sellerStatus: SellerStatus;
  sellerRequestedAt?: string;
  sellerReviewedAt?: string;
  sellerRequestMessage?: string;
  sellerRejectionReason?: string;
  sellerSuspensionReason?: string;
  sellerProfile?: { hostelNumber?: string; roomNumber?: string; courseYear?: string; mobileNumber?: string; college?: (College & { isActive?: boolean }) | null };
}

const FILTERS: { id: Filter; label: string; empty: string }[] = [
  { id: "pending", label: "Pending", empty: "New seller applications will appear here." },
  { id: "approved", label: "Approved", empty: "Approved sellers will appear here." },
  { id: "rejected", label: "Rejected", empty: "No rejected applications." },
  { id: "suspended", label: "Suspended", empty: "No suspended sellers." },
];

type Action = "approve" | "reject" | "suspend" | "reinstate";

export default function SellerRequests() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [accounts, setAccounts] = useState<SellerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Rejecting or suspending asks for a reason, shown to the seller.
  const [reasonFor, setReasonFor] = useState<{ id: string; action: "reject" | "suspend" } | null>(null);
  const [reason, setReason] = useState("");
  // Admin correction of a seller's college; affects their future listings only.
  const [collegeFor, setCollegeFor] = useState<string | null>(null);
  const [newCollege, setNewCollege] = useState<College | null>(null);

  async function changeCollege(account: SellerAccount) {
    if (!newCollege) return;
    if (!window.confirm(`Move ${account.name || account.email}'s future listings to ${newCollege.name}? Existing listings and orders keep their current college.`)) return;
    setBusy(account._id);
    try {
      await collegeService.adminSetSellerCollege(account._id, newCollege._id);
      setAccounts((current) => current.map((item) => (item._id === account._id ? { ...item, sellerProfile: { ...item.sellerProfile, college: newCollege } } : item)));
      setCollegeFor(null);
      toast.success("Seller college updated");
    } catch (err) {
      toast.error(errorMessage(err, "The college couldn't be changed."));
    } finally {
      setBusy(null);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await userService.getSellerRequests({ limit: 50, status: filter });
      setAccounts(data.users || []);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load sellers."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setReasonFor(null);
    void load();
  }, [load]);

  async function run(account: SellerAccount, action: Action, why = "") {
    const who = account.name || account.email;
    if (action === "approve" && !window.confirm(`Let ${who} list products in the store?`)) return;
    if (action === "reinstate" && !window.confirm(`Restore ${who}'s selling access?`)) return;
    setBusy(account._id);
    try {
      if (action === "approve" || action === "reinstate") await (action === "approve" ? userService.approveSeller(account._id) : userService.reinstateSeller(account._id));
      else if (action === "reject") await userService.rejectSeller(account._id, { reason: why });
      else await userService.suspendSeller(account._id, { reason: why });
      setAccounts((current) => current.filter((item) => item._id !== account._id));
      setReasonFor(null);
      setReason("");
      toast.success({ approve: `${who} can now sell`, reinstate: `${who} can sell again`, reject: "Application declined", suspend: `${who} is suspended` }[action]);
    } catch (err) {
      toast.error(errorMessage(err, "The seller couldn't be updated."));
    } finally {
      setBusy(null);
    }
  }

  const current = FILTERS.find((item) => item.id === filter)!;

  return (
    <div className="space-y-6">
      <PageHeading title="Sellers" description="Review seller applications and manage who can list products. Sellers see the reasons you give." />

      <div role="tablist" aria-label="Seller status" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-10 flex-1 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors ${filter === id ? "bg-white text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorNotice message={error} retry={load} />}
      {loading ? (
        <div className={panelClass}>
          <EmptyState loading />
        </div>
      ) : error ? null : accounts.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title={filter === "pending" ? "You're all caught up" : "Nothing here"} description={current.empty} />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => {
            const note = filter === "rejected" ? account.sellerRejectionReason : filter === "suspended" ? account.sellerSuspensionReason : "";
            const asking = reasonFor?.id === account._id ? reasonFor.action : null;
            return (
              <li key={account._id} className={`${panelClass} flex flex-col p-5`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{account.name || "Unnamed account"}</p>
                    <a href={`mailto:${account.email}`} className="mt-1 flex items-center gap-1.5 break-all text-sm text-teal-700">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {account.email}
                    </a>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(filter === "pending" ? account.sellerRequestedAt : account.sellerReviewedAt || account.sellerRequestedAt)}</span>
                </div>
                <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">Mobile</dt>
                    <dd className="break-all">{account.sellerProfile?.mobileNumber || "—"}</dd>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Home className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">Hostel and room</dt>
                    <dd>{[account.sellerProfile?.hostelNumber, account.sellerProfile?.roomNumber].filter(Boolean).join(" / ") || "—"}</dd>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 text-slate-600">
                    <School className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">College</dt>
                    <dd className={account.sellerProfile?.college ? "font-medium text-slate-800" : "text-amber-700"}>
                      {account.sellerProfile?.college
                        ? `${account.sellerProfile.college.name}${account.sellerProfile.college.isActive === false ? " (inactive)" : ""}`
                        : "No college yet"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                    <dt className="sr-only">Course year</dt>
                    <dd>{account.sellerProfile?.courseYear || "—"}</dd>
                  </div>
                </dl>
                {account.sellerRequestMessage && <p className="mb-4 break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{account.sellerRequestMessage}</p>}
                {note && (
                  <p className="mb-4 break-words rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Reason:</strong> {note}
                  </p>
                )}

                {collegeFor === account._id ? (
                  <div className="mt-auto space-y-3">
                    <p className="text-sm font-medium">Choose the seller's college (future listings only)</p>
                    <CollegeList selectedId={newCollege?._id} onSelect={setNewCollege} listClassName="max-h-48" />
                    <div className="flex gap-3">
                      <Button className="flex-1" disabled={!newCollege || busy === account._id} onClick={() => void changeCollege(account)}>
                        Save college
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setCollegeFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : asking ? (
                  <form
                    className="mt-auto space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(account, asking, reason.trim());
                    }}
                  >
                    <label htmlFor={`reason-${account._id}`} className="block text-sm font-medium">
                      {asking === "reject" ? "Why are you declining? (shown to the applicant)" : "Why are you suspending? (shown to the seller)"}
                    </label>
                    <textarea id={`reason-${account._id}`} rows={3} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
                    <div className="flex gap-3">
                      <Button type="submit" variant="destructive" className="flex-1" disabled={busy === account._id || !reason.trim()}>
                        {asking === "reject" ? "Decline application" : "Suspend seller"}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setReasonFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-auto flex gap-3">
                    {(filter === "pending" || filter === "rejected") && (
                      <Button className="flex-1" disabled={busy === account._id} onClick={() => void run(account, "approve")}>
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                    )}
                    {filter === "pending" && (
                      <Button variant="outline" className="flex-1 hover:border-red-200 hover:bg-red-50 hover:text-red-700" disabled={busy === account._id} onClick={() => { setReason(""); setReasonFor({ id: account._id, action: "reject" }); }}>
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    )}
                    {(filter === "approved" || filter === "suspended") && (
                      <Button variant="ghost" className="flex-1" disabled={busy === account._id} onClick={() => { setNewCollege(null); setCollegeFor(account._id); }}>
                        <School className="h-4 w-4" />
                        College
                      </Button>
                    )}
                    {filter === "approved" && (
                      <Button variant="outline" className="flex-1 hover:border-red-200 hover:bg-red-50 hover:text-red-700" disabled={busy === account._id} onClick={() => { setReason(""); setReasonFor({ id: account._id, action: "suspend" }); }}>
                        <Ban className="h-4 w-4" />
                        Suspend
                      </Button>
                    )}
                    {filter === "suspended" && (
                      <Button className="flex-1" disabled={busy === account._id} onClick={() => void run(account, "reinstate")}>
                        <RotateCcw className="h-4 w-4" />
                        Reinstate
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
