import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CollegeModeProvider, useCollegeMode } from "../../src/context/CollegeModeContext";
import { CollegeModeToggle, CollegePickerDialog } from "../../src/app/components/college/CollegeMode";

const IIITM = { _id: "a".repeat(24), name: "ABV-IIITM Gwalior", city: "Gwalior", state: "Madhya Pradesh", isActive: true };
const IITM = { _id: "b".repeat(24), name: "IIT Madras", city: "Chennai", state: "Tamil Nadu", isActive: true };

const auth = { isLoaded: true, isSignedIn: false };
vi.mock("@clerk/react", () => ({ useUser: () => auth }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const api = { list: vi.fn(), get: vi.fn(), getPreference: vi.fn(), savePreference: vi.fn() };
vi.mock("../../src/services/collegeService", () => ({
  collegeService: {
    list: (...a: unknown[]) => api.list(...a),
    get: (...a: unknown[]) => api.get(...a),
    getPreference: (...a: unknown[]) => api.getPreference(...a),
    savePreference: (...a: unknown[]) => api.savePreference(...a),
  },
}));

function Probe() {
  const { collegeFilter } = useCollegeMode();
  return <output data-testid="filter">{collegeFilter ?? "global"}</output>;
}

function renderMode() {
  return render(
    <CollegeModeProvider>
      <CollegeModeToggle />
      <CollegePickerDialog />
      <Probe />
    </CollegeModeProvider>,
  );
}

const toggle = () => screen.getByRole("switch", { name: "College Mode" });
const filter = () => screen.getByTestId("filter").textContent;

describe("College Mode (guest)", () => {
  beforeEach(() => {
    Object.assign(auth, { isLoaded: true, isSignedIn: false });
    Object.values(api).forEach((fn) => fn.mockReset());
    api.list.mockResolvedValue({ data: { colleges: [IIITM, IITM], total: 2 } });
  });

  it("asks for a college the first time, stays off if cancelled, and filters once chosen", async () => {
    renderMode();
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    fireEvent.click(toggle());
    expect(await screen.findByRole("heading", { name: "Choose Your College" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Choose Your College" })).not.toBeInTheDocument());
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(filter()).toBe("global");

    fireEvent.click(toggle());
    fireEvent.click(await screen.findByRole("button", { name: /ABV-IIITM Gwalior/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(filter()).toBe(IIITM._id));
    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("ABV-IIITM Gwalior", { selector: "strong" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("college-mode")!)).toEqual({ collegeId: IIITM._id, enabled: true });
  });

  it("remembers the college when turned off and turns back on without asking", async () => {
    localStorage.setItem("college-mode", JSON.stringify({ collegeId: IIITM._id, enabled: true }));
    api.get.mockResolvedValue({ data: { college: IIITM } });
    renderMode();
    await waitFor(() => expect(filter()).toBe(IIITM._id));
    fireEvent.click(toggle());
    await waitFor(() => expect(filter()).toBe("global"));
    expect(screen.getByText(/ABV-IIITM Gwalior saved/)).toBeInTheDocument();
    fireEvent.click(toggle());
    await waitFor(() => expect(filter()).toBe(IIITM._id));
    expect(screen.queryByRole("heading", { name: "Choose Your College" })).not.toBeInTheDocument();
  });

  it("drops a saved college that was deactivated", async () => {
    localStorage.setItem("college-mode", JSON.stringify({ collegeId: IIITM._id, enabled: true }));
    api.get.mockResolvedValue({ data: { college: { ...IIITM, isActive: false } } });
    renderMode();
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    expect(filter()).toBe("global");
    expect(toggle()).toHaveAttribute("aria-checked", "false");
  });
});

describe("College Mode (signed in)", () => {
  beforeEach(() => {
    Object.assign(auth, { isLoaded: true, isSignedIn: true });
    Object.values(api).forEach((fn) => fn.mockReset());
    api.list.mockResolvedValue({ data: { colleges: [IIITM, IITM], total: 2 } });
  });

  it("restores the server preference and keeps the toggle consistent when saving fails", async () => {
    api.getPreference.mockResolvedValue({ data: { preference: { college: IIITM, enabled: false } } });
    api.savePreference.mockRejectedValue({ response: { data: { message: "Network down" } } });
    renderMode();
    await waitFor(() => expect(screen.getByText(/ABV-IIITM Gwalior saved/)).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(toggle());
    });
    await waitFor(() => expect(api.savePreference).toHaveBeenCalledWith({ collegeId: undefined, enabled: true }));
    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(filter()).toBe("global");
  });

  it("saves a changed college to the profile", async () => {
    api.getPreference.mockResolvedValue({ data: { preference: { college: IIITM, enabled: true } } });
    api.savePreference.mockResolvedValue({ data: { preference: { college: IITM, enabled: true } } });
    renderMode();
    await waitFor(() => expect(filter()).toBe(IIITM._id));
    fireEvent.click(screen.getByRole("button", { name: "Change college" }));
    fireEvent.click(await screen.findByRole("button", { name: /IIT Madras/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(filter()).toBe(IITM._id));
    expect(api.savePreference).toHaveBeenCalledWith({ collegeId: IITM._id, enabled: true });
  });
});
