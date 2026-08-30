import Image from "next/image";

/** Compact campus-photo header shown only below the md breakpoint, where
 * LoginBrandingPanel (the full two-column photo panel) is hidden. */
export function LoginMobileHero() {
  return (
    <div className="relative h-52 w-full overflow-hidden bg-[#07162F] sm:h-60 md:hidden">
      <Image
        src="/images/asian-college-campus.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(7,22,47,0.75) 0%, rgba(7,22,47,0.3) 55%, rgba(7,22,47,0.6) 100%)",
        }}
      />
      <div className="relative flex h-full flex-col justify-center px-5 text-white">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/diploma-program-department-logo.png"
            alt="Diploma Program Department, Asian College"
            width={41}
            height={36}
            className="h-9 w-auto shrink-0"
          />
          <p className="text-xs font-bold tracking-wide">
            ASIAN COLLEGE OF SCIENCE AND TECHNOLOGY
          </p>
        </div>
        <h1 className="mt-3 text-xl leading-tight font-bold">
          Excellence in Service. <span className="text-[#F4B400]">Mastery in Hospitality.</span>
        </h1>
      </div>
    </div>
  );
}
