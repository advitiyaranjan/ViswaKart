import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function GoogleCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userRaw = params.get("user");
    const error = params.get("error");

    if (error || !token || !userRaw) {
      navigate("/login?error=google_failed", { replace: true });
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      // Full-page reload so AuthContext re-hydrates from localStorage
      window.location.replace("/");
    } catch {
      navigate("/login?error=google_failed", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
}
