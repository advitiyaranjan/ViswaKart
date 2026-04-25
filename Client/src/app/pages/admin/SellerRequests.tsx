import { useEffect, useState } from "react";
import { userService } from "../../../services/userService";
import { Button } from "../../components/Button";

export default function SellerRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      // debug API base
      // eslint-disable-next-line no-console
      console.log('[ADMIN] api base =', (await import('../../../services/api')).default.defaults.baseURL);
      const r = await userService.getSellerRequests({ limit: 50 });
      setRequests(r.data.users || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load requests');
      setRequests([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm("Approve seller access?")) return;
    try {
      await userService.approveSeller(id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject seller access?")) return;
    try {
      await userService.rejectSeller(id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to reject');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Seller Requests</h1>
      {error ? (
        <div className="text-destructive">{error}</div>
      ) : requests.length === 0 ? (
        <div className="text-muted-foreground">No pending requests</div>
      ) : (
        <div className="space-y-3">
          {requests.map((u) => (
            <div key={u._id} className="bg-white border rounded p-3 flex items-start justify-between">
              <div>
                <div className="font-medium">{u.name} — {u.email}</div>
                <div className="text-sm text-muted-foreground">Hostel: {u.sellerProfile?.hostelNumber} • Year: {u.sellerProfile?.courseYear} • Mobile: {u.sellerProfile?.mobileNumber}</div>
                <div className="text-sm mt-2">{u.sellerRequestMessage}</div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => handleApprove(u._id)}>Approve</Button>
                <Button variant="destructive" onClick={() => handleReject(u._id)}>Reject</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
