import { SignIn } from "@clerk/react";

export default function Login() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4">
      <SignIn
        routing="path"
        path="/login"
        forceRedirectUrl="/"
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
