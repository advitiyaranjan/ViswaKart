import { SignUp } from "@clerk/react";
import { useSearchParams } from "react-router";
import { safeRedirectPath } from "../../lib/redirect";

export default function Signup() {
  const [params] = useSearchParams();
  const redirect = safeRedirectPath(params.get("redirect"));
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4 py-10">
      <SignUp
        routing="hash"
        forceRedirectUrl={redirect}
        signInUrl={redirect === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirect)}`}
        signInForceRedirectUrl={redirect}
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
