import { useEffect, useRef } from "react";
import type { SetURLSearchParams } from "react-router";

/** Switching college (or turning College Mode on/off) starts paginated results again from page 1. */
export function usePageResetOnCollegeChange(collegeFilter: string | undefined, searchParams: URLSearchParams, setSearchParams: SetURLSearchParams) {
  const previous = useRef(collegeFilter);
  useEffect(() => {
    if (previous.current === collegeFilter) return;
    previous.current = collegeFilter;
    if (!searchParams.has("page")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [collegeFilter, searchParams, setSearchParams]);
}
