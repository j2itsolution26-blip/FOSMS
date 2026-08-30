import Image from "next/image";
import { GraduationCap, Award, FileText, BarChart3, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: GraduationCap,
    title: "Training Management",
    description: "Manage activities, schedules and progress",
  },
  {
    icon: Award,
    title: "Competency Tracking",
    description: "Monitor competency and assessment results",
  },
  {
    icon: FileText,
    title: "Evidence & Documents",
    description: "Upload and manage training evidence",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Real-time insights and performance reports",
  },
];

export function LoginBrandingPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#07162F] px-10 py-10 text-white md:flex md:w-[55%] md:flex-col md:justify-between lg:w-[58%] xl:px-16 xl:py-12">
      {/* Asian College campus — the visual anchor of the panel. */}
      <Image
        src="/images/asian-college-campus.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="(min-width: 1024px) 58vw, (min-width: 768px) 55vw, 100vw"
        className="object-cover object-center"
      />

      {/* Navy wash, left to right — grounds the copy against the photo while keeping
          the building itself clearly visible on the right side of the panel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(100deg, #07162F 0%, #07162F 30%, rgba(7,22,47,0.88) 44%, rgba(7,22,47,0.5) 60%, rgba(7,22,47,0.22) 76%, rgba(7,22,47,0.08) 92%)",
        }}
      />
      {/* Subtle overall bottom-up wash for footer legibility. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#07162F]/65 via-transparent to-[#07162F]/15"
      />
      {/* Soft vignette around the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(7,22,47,0.4) 100%)",
        }}
      />

      {/* Gold diagonal accent along the bottom edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-90"
        style={{
          background: "linear-gradient(100deg, transparent 60%, #F4B400 60.5%, #F4B400 62%, transparent 62.5%)",
        }}
      />

      <div className="relative">
        <Image
          src="/images/diploma-program-department-logo.png"
          alt="Diploma Program Department, Asian College"
          width={64}
          height={56}
          className="h-14 w-auto"
          priority
        />

        <p className="mt-6 text-sm font-bold tracking-wide">
          ASIAN COLLEGE
          <br />
          OF SCIENCE AND TECHNOLOGY
        </p>

        <h1 className="mt-4 text-3xl leading-tight font-bold xl:text-4xl">
          Excellence in Service.
          <br />
          <span className="text-[#F4B400]">Mastery in Hospitality.</span>
        </h1>
        <p className="mt-4 max-w-md text-sm text-white/70">
          A complete training and operations management system for Front Office Servicing NC II.
        </p>
        <div className="mt-6 h-1 w-14 rounded-full bg-[#F4B400]" aria-hidden />

        <ul className="mt-10 space-y-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <f.icon className="h-4.5 w-4.5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-sm text-white/60">{f.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center gap-2 text-white/60">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold text-white/80">Secure. Reliable. Trusted.</span>{" "}
          Your data is protected with enterprise-grade security.
        </p>
      </div>
    </div>
  );
}
