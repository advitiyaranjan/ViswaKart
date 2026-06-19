import { useEffect, useId, useRef, useState } from "react";
import { Check, GraduationCap, Loader2, RefreshCw, Search } from "lucide-react";
import { collegeService } from "../../../services/collegeService";
import { collegeLocation, type College } from "../../../lib/college";

interface Props {
  selectedId?: string | null;
  onSelect: (college: College) => void;
  /** Focus the search box when shown (e.g. inside a dialog). */
  autoFocus?: boolean;
  /** Max height of the scrollable results. */
  listClassName?: string;
  invalid?: boolean;
  describedBy?: string;
  label?: string;
}

/**
 * Searchable list of supported colleges, backed by the server's authoritative list.
 * Used by College Mode and seller registration so both always offer exactly the same colleges.
 */
export function CollegeList({ selectedId, onSelect, autoFocus, listClassName = "max-h-72", invalid, describedBy, label = "Search colleges" }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    // Debounced server-side search: users type their institution instead of scrolling a long list.
    const timer = setTimeout(() => {
      collegeService
        .list({ search: query.trim() || undefined, limit: 50 })
        .then(({ data }) => active && setColleges(data.colleges ?? []))
        .catch(() => active && setError(true))
        .finally(() => active && setLoading(false));
    }, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div>
      <label htmlFor={`${id}-search`} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={`${id}-search`}
          type="search"
          autoComplete="off"
          placeholder="Search by college name or city"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-controls={`${id}-list`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`min-h-12 w-full rounded-xl border bg-white py-3 pl-10 pr-10 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:text-sm ${invalid ? "border-destructive" : "border-border"}`}
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>

      <div className={`mt-3 overflow-y-auto overscroll-contain rounded-xl border border-border ${listClassName}`}>
        {error ? (
          <div role="alert" className="p-5 text-center text-sm">
            <p className="text-muted-foreground">We couldn't load the college list.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 font-semibold text-primary">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : loading && !colleges.length ? (
          <div role="status" className="space-y-2 p-3">
            {[1, 2, 3, 4].map((key) => (
              <div key={key} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
            <span className="sr-only">Loading colleges…</span>
          </div>
        ) : !colleges.length ? (
          <p role="status" className="p-5 text-center text-sm text-muted-foreground">
            No colleges match “{query.trim()}”. Try a shorter name or the city.
          </p>
        ) : (
          <ul id={`${id}-list`} aria-label="Colleges" className="divide-y divide-border">
            {colleges.map((college) => {
              const selected = college._id === selectedId;
              return (
                <li key={college._id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(college)}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:bg-accent focus-visible:outline-none ${selected ? "bg-primary/5" : "hover:bg-muted/60"}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary text-white" : "bg-muted text-primary"}`}>
                      <GraduationCap className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{college.name}</span>
                      {collegeLocation(college) && <span className="block truncate text-xs text-muted-foreground">{collegeLocation(college)}</span>}
                    </span>
                    {selected && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
