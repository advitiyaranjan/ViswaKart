import { InputHTMLAttributes, forwardRef, useId } from "react";
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = "", label, error, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div className="w-full min-w-0">
      {label && (
        <label htmlFor={inputId} className="block mb-2 text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`w-full min-h-11 px-4 py-2.5 bg-input-background border ${error ? "border-destructive" : "border-input"} rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary disabled:opacity-60 transition-colors ${className}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
Input.displayName = "Input";
