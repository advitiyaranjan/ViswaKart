import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AlertCircle, BadgeCheck, ClipboardList, PackagePlus, Send } from "lucide-react";
import { userService } from "../../../services/userService";
import { SELL_PATHS, type SellerApplication, type SellerSummary } from "../../../lib/seller";
import { Button } from "../../components/Button";
import { CollegeList } from "../../components/college/CollegeList";
import { collegeLocation, type College } from "../../../lib/college";
import { SellerGate, SellerPageFrame, sellerFieldClass } from "./SellerShell";

type Field = keyof SellerApplication;
type TextField = Exclude<Field, "collegeId">;

const FIELDS: { key: TextField; label: string; hint?: string; optional?: boolean; type?: string; inputMode?: "tel"; autoComplete?: string; placeholder?: string }[] = [
  { key: "name", label: "Full name", autoComplete: "name" },
  { key: "mobileNumber", label: "Mobile number", type: "tel", inputMode: "tel", autoComplete: "tel", hint: "Buyers and our team use this to reach you." },
  { key: "hostelNumber", label: "Hostel / block", placeholder: "e.g. BH-2" },
  { key: "roomNumber", label: "Room", placeholder: "e.g. 101" },
  { key: "courseYear", label: "Course & year", optional: true, placeholder: "e.g. B.Tech, 2nd year" },
];

export function validateApplication(form: SellerApplication) {
  const errors: Partial<Record<Field, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!/^[0-9]{7,15}$/.test(form.mobileNumber.replace(/\D/g, ""))) errors.mobileNumber = "Enter a valid 7–15 digit mobile number.";
  if (!form.hostelNumber.trim()) errors.hostelNumber = "Tell buyers where to collect from.";
  if (!form.roomNumber.trim()) errors.roomNumber = "Enter your room number.";
  if ((form.message || "").length > 1000) errors.message = "Keep your note under 1000 characters.";
  if (!form.collegeId) errors.collegeId = "Select the college associated with your seller account.";
  return errors;
}

function RegisterForm({ seller }: { seller: SellerSummary }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<SellerApplication>({
    name: seller.profile.name,
    mobileNumber: seller.profile.mobileNumber,
    hostelNumber: seller.profile.hostelNumber,
    roomNumber: seller.profile.roomNumber,
    courseYear: seller.profile.courseYear,
    message: seller.message === "Requested via app" ? "" : seller.message,
    collegeId: seller.college?._id ?? "",
  });
  const [college, setCollege] = useState<College | null>(seller.college ?? null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const resubmitting = seller.status === "rejected";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validateApplication(form);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      document.getElementById(first === "collegeId" ? "apply-college" : `apply-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`apply-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await userService.requestSellerAccess({ ...form, mobileNumber: form.mobileNumber.replace(/\D/g, "") });
      toast.success("Application sent. We'll review it shortly.");
      navigate(SELL_PATHS.status, { replace: true });
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.errors) setErrors(data.errors);
      // Already pending or approved elsewhere (e.g. another tab): the status page shows the truth.
      if (err?.response?.status === 409 || err?.response?.status === 403) return navigate(SELL_PATHS.entry, { replace: true });
      setSubmitError(data?.message || "Your application couldn't be sent. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const update = (key: TextField) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  return (
    <SellerPageFrame
      title={resubmitting ? "Update your seller application" : "Become a seller"}
      description="Tell us a little about yourself. Once an admin approves your application you can start listing products."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-border bg-white p-5 sm:p-7">
          {resubmitting && (
            <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Your previous application wasn't approved.</p>
                <p className="mt-1">{seller.reason || "No reason was given. Check your details and resubmit."}</p>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, hint, optional, type, inputMode, autoComplete, placeholder }) => (
              <div key={key}>
                <label htmlFor={`apply-${key}`} className="mb-1.5 block text-sm font-medium">
                  {label} {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
                </label>
                <input
                  id={`apply-${key}`}
                  type={type || "text"}
                  inputMode={inputMode}
                  autoComplete={autoComplete}
                  placeholder={placeholder}
                  value={form[key] ?? ""}
                  onChange={update(key)}
                  maxLength={key === "name" ? 100 : 50}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `apply-${key}-error` : hint ? `apply-${key}-hint` : undefined}
                  className={sellerFieldClass}
                />
                {errors[key] ? (
                  <p id={`apply-${key}-error`} className="mt-1 text-xs text-destructive">
                    {errors[key]}
                  </p>
                ) : (
                  hint && (
                    <p id={`apply-${key}-hint`} className="mt-1 text-xs text-muted-foreground">
                      {hint}
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
          <fieldset id="apply-college" aria-describedby="apply-college-hint">
            <legend className="mb-1.5 block text-sm font-medium">College / Institution</legend>
            <p id="apply-college-hint" className="mb-3 text-xs text-muted-foreground">
              Select the college associated with your seller account. Your products will be listed under this college's shopping community.
            </p>
            {college && (
              <p className="mb-3 rounded-xl bg-primary/5 px-3 py-2 text-sm">
                Selected: <strong>{college.name}</strong>
                {collegeLocation(college) && <span className="text-muted-foreground"> · {collegeLocation(college)}</span>}
              </p>
            )}
            <CollegeList
              label="Search for your college"
              selectedId={form.collegeId}
              invalid={Boolean(errors.collegeId)}
              describedBy={errors.collegeId ? "apply-collegeId-error" : "apply-college-hint"}
              listClassName="max-h-60"
              onSelect={(next) => {
                setCollege(next);
                setForm((current) => ({ ...current, collegeId: next._id }));
                setErrors((current) => ({ ...current, collegeId: undefined }));
              }}
            />
            {errors.collegeId && (
              <p id="apply-collegeId-error" className="mt-1 text-xs text-destructive">
                {errors.collegeId}
              </p>
            )}
          </fieldset>
          <div>
            <label htmlFor="apply-message" className="mb-1.5 block text-sm font-medium">
              What would you like to sell? <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="apply-message"
              rows={4}
              maxLength={1000}
              value={form.message ?? ""}
              onChange={update("message")}
              placeholder="Books, electronics, hostel essentials…"
              aria-invalid={Boolean(errors.message)}
              className={sellerFieldClass}
            />
            {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
          </div>
          {submitError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {submitError}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            {submitting ? "Sending application…" : resubmitting ? "Resubmit application" : "Submit application"}
          </Button>
        </form>

        <aside className="rounded-2xl border border-border bg-[#edf5f0] p-5 sm:p-6">
          <h2 className="font-semibold">How selling works</h2>
          <ol className="mt-4 space-y-4 text-sm">
            {[
              { icon: ClipboardList, title: "Apply", text: "Share your contact and pickup details." },
              { icon: BadgeCheck, title: "Get approved", text: "An admin reviews applications, usually within a day." },
              { icon: PackagePlus, title: "List & sell", text: "Add photos, set your price and manage orders." },
            ].map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span>
                  <span className="block font-medium">
                    {index + 1}. {title}
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </SellerPageFrame>
  );
}

export default function SellerRegister() {
  return <SellerGate path={SELL_PATHS.register}>{({ seller }) => <RegisterForm seller={seller} />}</SellerGate>;
}
