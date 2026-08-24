import { BedDouble, Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Laurel-wreath crest mark — purely decorative, no accreditation claim of its own. */
export function BrandCrest({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const dims = size === "sm" ? "h-14 w-14" : "h-16 w-16";
  const iconBox = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <div className={cn("relative flex items-center justify-center", dims, className)}>
      <div className="absolute -top-1 flex gap-1 text-[#F4B400]">
        <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
        <Star className="h-3 w-3 fill-current" aria-hidden />
        <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
      </div>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full text-[#F4B400]/70"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        {/* Left laurel branch */}
        <path d="M22 30 Q10 50 22 74" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`l${i}`} d={`M${22 - i * 0.5} ${34 + i * 9} Q12 ${33 + i * 9} 10 ${29 + i * 9}`} />
        ))}
        {/* Right laurel branch */}
        <path d="M78 30 Q90 50 78 74" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`r${i}`} d={`M${78 + i * 0.5} ${34 + i * 9} Q88 ${33 + i * 9} 90 ${29 + i * 9}`} />
        ))}
      </svg>
      <div className={cn("flex items-center justify-center rounded-lg bg-[#0B1F44] text-[#F4B400]", iconBox)}>
        <BedDouble className={size === "sm" ? "h-4 w-4" : "h-4.5 w-4.5"} aria-hidden />
      </div>
    </div>
  );
}
