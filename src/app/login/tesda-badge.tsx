import { ShieldCheck } from "lucide-react";

export function TesdaBadge() {
  return (
    <div className="fixed top-4 right-4 z-10 flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0B1F44] shadow-sm backdrop-blur-sm sm:top-6 sm:right-6">
      <ShieldCheck className="h-3.5 w-3.5 text-[#F4B400]" aria-hidden />
      TESDA ACCREDITED
    </div>
  );
}
