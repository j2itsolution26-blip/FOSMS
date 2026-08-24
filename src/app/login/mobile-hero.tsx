import Image from "next/image";
import { BedDouble } from "lucide-react";

/** Compact reception-photo header shown only below the md breakpoint, where
 * LoginBrandingPanel (the full two-column photo panel) is hidden. */
export function LoginMobileHero() {
  return (
    <div className="relative h-52 w-full overflow-hidden bg-[#07162F] sm:h-60 md:hidden">
      {/* A separate, pre-cropped photo (not login-front-office.jpg) — this banner's
          aspect ratio is wider than the source photo, so object-cover would show
          its full width, including the left zone where that image's own headline
          text is baked in as pixels. This crop excludes that zone entirely. */}
      <Image
        src="/images/login-front-office-wide.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-[45%_30%]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(7,22,47,0.75) 0%, rgba(7,22,47,0.35) 55%, rgba(7,22,47,0.55) 100%)",
        }}
      />
      <div className="relative flex h-full flex-col justify-center px-5 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4B400]/15 text-[#F4B400]">
            <BedDouble className="h-4.5 w-4.5" aria-hidden />
          </div>
          <p className="text-xs font-bold tracking-wide">
            FRONT OFFICE SERVICING <span className="text-[#F4B400]">NC II</span>
          </p>
        </div>
        <h1 className="mt-3 text-xl leading-tight font-bold">
          Excellence in Service. <span className="text-[#F4B400]">Mastery in Hospitality.</span>
        </h1>
      </div>
    </div>
  );
}
