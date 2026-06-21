import { useEffect, useState } from "react";
import { Link } from "react-router";
import { GraduationCap, Loader2, Store } from "lucide-react";
import { useCollegeMode } from "../../../context/CollegeModeContext";
import { collegeLocation, type College } from "../../../lib/college";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Switch } from "../ui/switch";
import { Button, buttonClass } from "../Button";
import { CollegeList } from "./CollegeList";

/** "Choose Your College" dialog. Closing it without choosing leaves College Mode as it was. */
export function CollegePickerDialog() {
  const { pickerOpen, closePicker, chooseCollege, college, saving } = useCollegeMode();
  const [choice, setChoice] = useState<College | null>(college);

  useEffect(() => {
    if (pickerOpen) setChoice(college);
  }, [pickerOpen, college]);

  return (
    <Dialog open={pickerOpen} onOpenChange={(open) => !open && !saving && closePicker()}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3 pr-8">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <DialogTitle className="text-xl">Choose Your College</DialogTitle>
            <DialogDescription className="mt-1.5">Select your college to discover products available within your campus community.</DialogDescription>
          </div>
        </div>
        <CollegeList autoFocus selectedId={choice?._id} onSelect={setChoice} listClassName="max-h-[min(18rem,45dvh)]" />
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={closePicker} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => choice && void chooseCollege(choice)} disabled={!choice || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Homepage card with the College Mode switch and the selected college. */
export function CollegeModeToggle() {
  const { enabled, college, ready, saving, enable, disable, openPicker } = useCollegeMode();
  return (
    <section aria-label="College Mode" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-5 ${enabled ? "border-primary/30 bg-primary/5" : "border-border bg-white"}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${enabled ? "bg-primary text-white" : "bg-[#edf5f0] text-primary"}`}>
            <GraduationCap className="h-5.5 w-5.5" />
          </span>
          <div className="min-w-0">
            <p id="college-mode-label" className="font-semibold">
              College Mode
            </p>
            <p className="truncate text-sm text-muted-foreground" aria-live="polite">
              {!ready ? "Loading your preference…" : enabled && college ? (
                <>
                  Shopping within <strong className="font-semibold text-foreground">{college.name}</strong>
                </>
              ) : college ? (
                `Off · ${college.name} saved`
              ) : (
                "See products from your campus community only"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          {ready && college && (
            <button type="button" onClick={openPicker} className="min-h-11 text-sm font-semibold text-primary hover:underline">
              Change college
            </button>
          )}
          <div className="flex items-center gap-2.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
            <span className={`w-7 text-right text-xs font-bold ${enabled ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true">
              {enabled ? "ON" : "OFF"}
            </span>
            <Switch
              aria-labelledby="college-mode-label"
              checked={enabled}
              disabled={!ready || saving}
              onCheckedChange={(on) => void (on ? enable() : disable())}
              className="scale-125"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Slim reminder shown under the header on store pages while College Mode filters results. */
export function CollegeModeBar() {
  const { enabled, college, openPicker, disable, saving } = useCollegeMode();
  if (!enabled || !college) return null;
  return (
    <div className="border-b border-primary/15 bg-primary/5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-sm sm:px-6 lg:px-8">
        <p className="flex min-w-0 items-center gap-2">
          <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">
            <span className="font-semibold text-primary">College Mode</span> · {college.name}
          </span>
        </p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={openPicker} className="min-h-9 rounded-lg px-2 font-medium text-primary hover:bg-primary/10">
            Change
          </button>
          <button type="button" onClick={() => void disable()} disabled={saving} className="min-h-9 rounded-lg px-2 font-medium text-muted-foreground hover:bg-muted">
            Turn off
          </button>
        </div>
      </div>
    </div>
  );
}

/** Empty state for a college with no matching products. */
export function CollegeEmptyState({ filtered = false }: { filtered?: boolean }) {
  const { college, openPicker, disable } = useCollegeMode();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
      <GraduationCap className="mx-auto h-12 w-12 text-primary" strokeWidth={1.4} />
      <h2 className="mt-4 text-lg font-semibold">No products found for your college yet.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {filtered ? "Try another category or clear your filters" : "Try another category"} or check back later as more sellers join{" "}
        {college ? `the ${college.name}` : "your college"} community.
      </p>
      {college && collegeLocation(college) && <p className="mt-1 text-xs text-muted-foreground">{collegeLocation(college)}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/products" className={buttonClass("outline")}>
          Browse categories
        </Link>
        <Button variant="outline" onClick={openPicker}>
          Change college
        </Button>
        <Button variant="ghost" onClick={() => void disable()}>
          Turn off College Mode
        </Button>
      </div>
      <Link to="/sell" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <Store className="h-4 w-4" /> Sell something to your campus
      </Link>
    </div>
  );
}
