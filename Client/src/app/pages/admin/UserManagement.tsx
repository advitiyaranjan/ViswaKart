import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Pencil, Shield, UserRound, UserRoundX, UserRoundCheck } from "lucide-react";
import { Button } from "../../components/Button";
import { userService } from "../../../services/userService";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { PageHeading, ErrorNotice, EmptyState, Pagination, inputClass, panelClass, actionClass, formatDate, errorMessage } from "./AdminUI";
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  isSeller?: boolean;
}
export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [nextRole, setNextRole] = useState("user");
  const [saving, setSaving] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20, search: search.trim() || undefined, role: role || undefined };
      const { data } = await userService.getUsers(params);
      if (id === requestId.current) {
        setUsers(data.users || []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err, "We couldn't load user accounts."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, search, role]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [load]);
  const changeAccess = async (user: User) => {
    if (
      !window.confirm(
        `${user.isActive ? "Deactivate" : "Reactivate"} access for ${user.name || user.email}? ${user.isActive ? "Their order history will be retained." : "They will be able to use the account again."}`,
      )
    )
      return;
    setSaving(user._id);
    try {
      await userService.updateUser(user._id, { isActive: !user.isActive });
      await load();
      toast.success(user.isActive ? "Account deactivated" : "Account reactivated");
    } catch (err) {
      toast.error(errorMessage(err, "Account access could not be updated."));
    } finally {
      setSaving(null);
    }
  };
  const changeRole = async () => {
    if (!editing) return;
    setSaving(editing._id);
    setFormError("");
    try {
      await userService.updateUser(editing._id, { role: nextRole });
      setEditing(null);
      await load();
      toast.success("Account role updated");
    } catch (err) {
      setFormError(errorMessage(err, "The role could not be updated."));
    } finally {
      setSaving(null);
    }
  };
  const isSelf = (user: User) => currentUser?._id === user._id || currentUser?.email?.toLowerCase() === user.email?.toLowerCase();
  const actions = (user: User) => (
    <div className="flex items-center gap-1">
      <button
        aria-label={`Change role for ${user.name}`}
        disabled={isSelf(user) || saving === user._id}
        title={isSelf(user) ? "Your own administrator access cannot be changed here" : "Change role"}
        className={actionClass}
        onClick={() => {
          setEditing(user);
          setNextRole(user.role);
          setFormError("");
        }}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        aria-label={`${user.isActive ? "Deactivate" : "Reactivate"} ${user.name}`}
        disabled={isSelf(user) || saving === user._id}
        className={`${actionClass} ${user.isActive ? "hover:!bg-rose-50 hover:!text-rose-600" : ""}`}
        onClick={() => void changeAccess(user)}
      >
        {user.isActive ? <UserRoundX className="h-4 w-4" /> : <UserRoundCheck className="h-4 w-4" />}
      </button>
    </div>
  );
  const roleBadge = (user: User) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${user.role === "admin" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"}`}
    >
      {user.role === "admin" ? <Shield className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
      {user.role === "admin" ? "Administrator" : "Customer"}
    </span>
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title="Customers & team"
        description="Manage account access and administrator permissions while keeping customer history intact."
      />
      <div className={`${panelClass} flex flex-col gap-3 p-4 sm:flex-row`}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            aria-label="Search users"
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          className={`${inputClass} sm:max-w-48`}
        >
          <option value="">All roles</option>
          <option value="admin">Administrators</option>
          <option value="user">Customers</option>
        </select>
      </div>
      {error && <ErrorNotice message={error} retry={load} />}
      <section className={`${panelClass} overflow-hidden`}>
        {loading ? (
          <EmptyState loading />
        ) : error ? null : users.length === 0 ? (
          <EmptyState title="No matching accounts" description="Try a different name, email address or role filter." />
        ) : (
          <>
            <div className="divide-y divide-slate-100 xl:hidden">
              {users.map((user) => (
                <article key={user._id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">
                        {user.name || "Unnamed account"}
                        {isSelf(user) && <span className="ml-2 text-xs font-normal text-slate-400">You</span>}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">{user.email}</p>
                    </div>
                    {actions(user)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {roleBadge(user)}
                    <span className={`text-xs ${user.isActive ? "text-teal-700" : "text-rose-600"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                    {user.isSeller && <span className="text-xs text-slate-500">· Seller</span>}
                  </div>
                  <p className="text-xs text-slate-400">Joined {formatDate(user.createdAt)}</p>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {["Account", "Role", "Access", "Joined", "Actions"].map((heading) => (
                      <th key={heading} className="px-5 py-4 text-left font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {(user.name || "?")
                              .split(" ")
                              .map((value) => value[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold">
                              {user.name || "Unnamed account"}
                              {isSelf(user) && <span className="ml-2 text-xs font-normal text-slate-400">You</span>}
                            </p>
                            <p className="mt-1 max-w-64 truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {roleBadge(user)}
                        {user.isSeller && <p className="mt-1 text-xs text-slate-500">Approved seller</p>}
                      </td>
                      <td className={`px-5 py-4 text-xs font-medium ${user.isActive ? "text-teal-700" : "text-rose-600"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                      <td className="px-5 py-4">{actions(user)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!error && <Pagination page={page} total={total} onChange={setPage} loading={loading} />}
      </section>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-white">
          <DialogTitle>Change account role</DialogTitle>
          <DialogDescription>
            Update access for {editing?.name || editing?.email}. Administrators can manage products, orders and other users.
          </DialogDescription>
          {formError && <ErrorNotice message={formError} />}
          <label htmlFor="account-role" className="text-sm font-medium">
            Account role
          </label>
          <select id="account-role" value={nextRole} onChange={(event) => setNextRole(event.target.value)} className={inputClass}>
            <option value="user">Customer</option>
            <option value="admin">Administrator</option>
          </select>
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={!!saving} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={!!saving || nextRole === editing?.role} onClick={() => void changeRole()}>
              {saving ? "Saving…" : "Save role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
