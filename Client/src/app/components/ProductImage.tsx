import { useState, useEffect, ImgHTMLAttributes } from "react";
import { Package } from "lucide-react";
export function ProductImage({ src, alt, className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed)
    return (
      <div
        role="img"
        aria-label={alt || "Product image unavailable"}
        className={`flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground ${className}`}
      >
        <Package className="h-10 w-10" strokeWidth={1.2} />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  return <img src={src} alt={alt || ""} className={className} onError={() => setFailed(true)} {...props} />;
}
