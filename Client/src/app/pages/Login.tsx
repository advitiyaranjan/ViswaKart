import { SignIn } from "@clerk/react";
import { useLocation, useSearchParams } from "react-router";
import { safeRedirectPath } from "../../lib/redirect";

export default function Login() {
  const location = useLocation();
  const [params] = useSearchParams();
  const from = location.state?.from;
  // Where the visitor was heading (e.g. /sell or /checkout), from router state or a ?redirect= link.
  const redirect = safeRedirectPath(from?.pathname ? `${from.pathname}${from.search || ""}` : params.get("redirect"));
  const signUpUrl = redirect === "/" ? "/signup" : `/signup?redirect=${encodeURIComponent(redirect)}`;
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-slate-50 px-4 py-10">
      {redirect.startsWith("/sell") && (
        <p className="mb-5 max-w-md text-center text-sm text-muted-foreground">Sign in or create an account to start selling. We'll bring you right back.</p>
      )}
      <SignIn
        routing="hash"
        forceRedirectUrl={redirect}
        signUpUrl={signUpUrl}
        signUpForceRedirectUrl={redirect}
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "shadow-sm border border-slate-200 rounded-2xl",
          },
        }}
      />
    </div>
  );
}
