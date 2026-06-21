import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import { collegeService } from "../services/collegeService";
import { isCollegeId, type College } from "../lib/college";
import { readStored, writeStored } from "../lib/commerce";

const STORAGE_KEY = "college-mode";

interface Stored {
  collegeId?: string;
  enabled?: boolean;
}

interface CollegeModeValue {
  /** College Mode is on and a valid college is selected. */
  enabled: boolean;
  /** The remembered college, kept even while the mode is off. */
  college: College | null;
  /** College ID to send to product APIs, or undefined for the global catalogue. */
  collegeFilter: string | undefined;
  /** The saved preference has been restored (avoids flashing global results first). */
  ready: boolean;
  saving: boolean;
  pickerOpen: boolean;
  /** Turns the mode on, asking for a college first if none is saved. */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  openPicker: () => void;
  closePicker: () => void;
  /** Saves a college and turns the mode on. Resolves false (state unchanged) if saving failed. */
  chooseCollege: (college: College) => Promise<boolean>;
  /** Called when the API reports the selected college no longer exists. */
  markUnavailable: () => void;
}

const CollegeModeContext = createContext<CollegeModeValue | null>(null);

/**
 * College Mode is a discovery preference: it narrows product results to one campus and never touches the cart.
 * Signed-in users' preference lives on their profile (server); guests keep it in this browser.
 */
export function CollegeModeProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const [college, setCollege] = useState<College | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const lastRestore = useRef(0);

  const remember = (next: { college: College | null; enabled: boolean }) => {
    setCollege(next.college);
    setEnabled(next.enabled && Boolean(next.college));
    writeStored(STORAGE_KEY, { collegeId: next.college?._id, enabled: next.enabled });
  };

  // Restore the saved preference whenever the signed-in state settles or changes.
  useEffect(() => {
    if (!isLoaded) return;
    const run = ++lastRestore.current;
    const stored = readStored<Stored>(STORAGE_KEY, {});
    const stale = () => run !== lastRestore.current;
    (async () => {
      try {
        if (isSignedIn) {
          const { data } = await collegeService.getPreference();
          if (stale()) return;
          let pref = data.preference;
          // First sign-in on this device: adopt the choice the visitor already made here as a guest.
          if (!pref.college && !pref.unavailable && isCollegeId(stored.collegeId)) {
            pref = (await collegeService.savePreference({ collegeId: stored.collegeId, enabled: Boolean(stored.enabled) }).catch(() => ({ data: { preference: pref } }))).data.preference;
            if (stale()) return;
          }
          if (pref.unavailable) toast.info("Your saved college is no longer available in College Mode. Choose another one to turn it back on.");
          remember({ college: pref.unavailable ? null : pref.college, enabled: pref.enabled });
        } else if (isCollegeId(stored.collegeId)) {
          // Guests: re-validate the saved ID against the authoritative list.
          const { data } = await collegeService.get(stored.collegeId).catch(() => ({ data: { college: null as College | null } }));
          if (stale()) return;
          if (!data.college?.isActive) {
            if (stored.enabled) toast.info("Your saved college is no longer available in College Mode.");
            remember({ college: null, enabled: false });
          } else remember({ college: data.college, enabled: Boolean(stored.enabled) });
        } else {
          remember({ college: null, enabled: false });
        }
      } catch {
        // Offline or API down: fall back to the global catalogue rather than a broken filter.
        if (!stale()) setEnabled(false);
      } finally {
        if (!stale()) setReady(true);
      }
    })();
  }, [isLoaded, isSignedIn]);

  const save = useCallback(
    async (next: { college: College; enabled: boolean; changed: boolean }) => {
      setSaving(true);
      try {
        if (isSignedIn) {
          const { data } = await collegeService.savePreference({ collegeId: next.changed ? next.college._id : undefined, enabled: next.enabled });
          remember({ college: data.preference.college, enabled: data.preference.enabled });
        } else {
          remember({ college: next.college, enabled: next.enabled });
        }
        return true;
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "We couldn't update College Mode. Please try again.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [isSignedIn],
  );

  const chooseCollege = useCallback(
    async (next: College) => {
      const ok = await save({ college: next, enabled: true, changed: next._id !== college?._id || !enabled });
      if (ok) {
        setPickerOpen(false);
        toast.success(`College Mode on · shopping within ${next.name}`);
      }
      return ok;
    },
    [save, college, enabled],
  );

  const enable = useCallback(async () => {
    if (!college) return setPickerOpen(true);
    await save({ college, enabled: true, changed: false });
  }, [college, save]);

  const disable = useCallback(async () => {
    if (!college) return setEnabled(false);
    await save({ college, enabled: false, changed: false });
  }, [college, save]);

  const markUnavailable = useCallback(() => {
    toast.info("That college is no longer available in College Mode. Choose another one.");
    remember({ college: null, enabled: false });
    if (isSignedIn) void collegeService.savePreference({ enabled: false }).catch(() => {});
  }, [isSignedIn]);

  const value = useMemo<CollegeModeValue>(
    () => ({
      enabled,
      college,
      collegeFilter: enabled && college ? college._id : undefined,
      ready,
      saving,
      pickerOpen,
      enable,
      disable,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
      chooseCollege,
      markUnavailable,
    }),
    [enabled, college, ready, saving, pickerOpen, enable, disable, chooseCollege, markUnavailable],
  );

  return <CollegeModeContext.Provider value={value}>{children}</CollegeModeContext.Provider>;
}

export function useCollegeMode() {
  const ctx = useContext(CollegeModeContext);
  if (!ctx) throw new Error("useCollegeMode must be used within CollegeModeProvider");
  return ctx;
}
