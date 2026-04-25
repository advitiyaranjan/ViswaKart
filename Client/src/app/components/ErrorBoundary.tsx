import React from "react";
import { useRouteError } from "react-router";

export default function ErrorBoundary() {
  const error = useRouteError() as any;
  // Log to console for developer diagnostics
  console.error("Route error:", error);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-xl border p-6 max-w-lg w-full text-center">
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred. Try refreshing the page or contact support if the problem persists.</p>
        <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
          {String(error?.message ?? error)}
        </div>
        <div className="mt-4 flex gap-2 justify-center">
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded">Reload</button>
          <a href="/" className="px-4 py-2 border rounded">Home</a>
        </div>
      </div>
    </div>
  );
}
