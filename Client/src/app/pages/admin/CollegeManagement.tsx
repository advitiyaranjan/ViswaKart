import { useCallback, useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { collegeService } from "../../../services/collegeService";
import type { College } from "../../../lib/college";
import { Button } from "../../components/Button";
import { PageHeading, ErrorNotice, EmptyState, panelClass, errorMessage, inputClass } from "./AdminUI";

interface AdminCollege extends College {
  emailDomains?: string[];
}

const EMPTY = { name: "", city: "", state: "", country: "India", emailDomains: "" };

/** The authoritative list used by College Mode, seller registration and product associations. */
export default function CollegeManagement() {
  const [colleges, setColleges] = useState<AdminCollege[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<AdminCollege | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await collegeService.list({ includeInactive: true, limit: 200, search: search.trim() || undefined });
      setColleges(data.colleges ?? []);
    } catch (err) {
      setError(errorMessage(err, "We couldn't load colleges."));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  function open(college: AdminCollege | null) {
    setEditing(college);
    setForm(
      college
        ? { name: college.name, city: college.city || "", state: college.state || "", country: college.country || "India", emailDomains: (college.emailDomains || []).join(", ") }
        : EMPTY,
    );
    setFormError("");
    setShowForm(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.name.trim().length < 2) return setFormError("Enter the college name.");
    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      emailDomains: form.emailDomains.split(/[\s,]+/).filter(Boolean),
    };
    setSaving(true);
    setFormError("");
    try {
      if (editing) await collegeService.update(editing._id, payload);
      else await collegeService.create(payload);
      toast.success(editing ? "College updated" : "College added");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err, "The college couldn't be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(college: AdminCollege) {
    const next = !college.isActive;
    if (!next && !window.confirm(`Hide ${college.name} from College Mode and seller registration? Existing sellers, products and orders keep it.`)) return;
    try {
      await collegeService.update(college._id, { isActive: next });
      setColleges((current) => current.map((item) => (item._id === college._id ? { ...item, isActive: next } : item)));
      toast.success(next ? `${college.name} is available again` : `${college.name} deactivated`);
    } catch (err) {
      toast.error(errorMessage(err, "The college couldn't be updated."));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Colleges"
        description="Colleges shoppers can choose in College Mode and sellers list under. Deactivate instead of deleting so past listings and orders stay intact."
        action={
          <Button onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            Add college
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={submit} className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`} noValidate>
          <h2 className="font-semibold sm:col-span-2">{editing ? `Edit ${editing.name}` : "Add a college"}</h2>
          {(
            [
              ["name", "College name", "sm:col-span-2"],
              ["city", "City", ""],
              ["state", "State", ""],
              ["country", "Country", ""],
              ["emailDomains", "Verified email domains (optional)", ""],
            ] as const
          ).map(([key, label, span]) => (
            <div key={key} className={span}>
              <label htmlFor={`college-${key}`} className="mb-1.5 block text-sm font-medium">
                {label}
              </label>
              <input
                id={`college-${key}`}
                value={form[key]}
                placeholder={key === "emailDomains" ? "e.g. iiitm.ac.in" : undefined}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                className={inputClass}
              />
            </div>
          ))}
          <p className="text-xs text-slate-500 sm:col-span-2">
            Verified accounts with an email on these domains are recognised as members of this college.
          </p>
          {formError && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {formError}
            </p>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add college"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <label htmlFor="college-search" className="sr-only">
          Search colleges
        </label>
        <input id="college-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search colleges" className={`${inputClass} pl-9`} />
      </div>

      {error && <ErrorNotice message={error} retry={load} />}
      <div className={panelClass}>
        {loading ? (
          <EmptyState loading />
        ) : colleges.length === 0 ? (
          <EmptyState title="No colleges yet" description="Add a college, or run `npm run seed:colleges` on the server to load the starter list." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {colleges.map((college) => (
              <li key={college._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${college.isActive ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-400"}`}>
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {college.name} {!college.isActive && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {[college.city, college.state, college.country].filter(Boolean).join(", ")}
                      {college.emailDomains?.length ? ` · ${college.emailDomains.join(", ")}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => open(college)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void toggleActive(college)}>
                    {college.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
