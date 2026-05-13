import { SignIn } from "@clerk/react";
import { useLocation } from "react-router";

export default function Login() {
  const location = useLocation();
  const from = location.state?.from;
  const redirect = from?.pathname?.startsWith("/") && !from.pathname.startsWith("//") ? `${from.pathname}${from.search || ""}` : "/";
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4">
      <SignIn
        routing="hash"
        forceRedirectUrl={redirect}
        signUpUrl="/signup"
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
