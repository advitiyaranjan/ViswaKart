export interface College {
  _id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export interface CollegePreference {
  college: College | null;
  enabled: boolean;
  /** The saved college was deactivated by an admin. */
  unavailable?: boolean;
}

/** "Gwalior, Madhya Pradesh" — distinguishes similarly named institutions. */
export function collegeLocation(college: Pick<College, "city" | "state">) {
  return [college.city, college.state].filter(Boolean).join(", ");
}

export const isCollegeId = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
