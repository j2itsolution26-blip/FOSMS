import { BedDouble, ClipboardList, Award, FolderOpen, BarChart3, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Training Management",
    description: "Manage activities, schedules, and training progress.",
  },
  {
    icon: Award,
    title: "Competency Tracking",
    description: "Monitor competencies and assessment results.",
  },
  {
    icon: FolderOpen,
    title: "Evidence & Documents",
    description: "Upload and manage training evidence and documents.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Track performance and training outcomes.",
  },
];

export function LoginBrandingPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-linear-to-b from-[#0B1F44] to-[#07162F] px-10 py-12 text-white lg:flex lg:w-[45%] lg:flex-col lg:justify-between xl:px-14">
      {/* Subtle background pattern — no imagery, keeps the panel fast-loading. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4B400]/15 text-[#F4B400]">
            <BedDouble className="h-5.5 w-5.5" aria-hidden />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-[#F4B400]">FRONT OFFICE SERVICING NC II</p>
            <p className="text-xs text-white/60">Training & Operations Management System</p>
          </div>
        </div>

        <h1 className="mt-10 text-3xl leading-tight font-bold xl:text-4xl">
          Professional Training.
          <br />
          Excellence in Hospitality.
        </h1>
        <p className="mt-4 max-w-md text-sm text-white/70">
          A complete training and operations management platform for Front Office Servicing NC II.
        </p>

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

      <div className="relative flex items-start gap-2.5 border-t border-white/10 pt-6 text-white/60">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold text-white/80">Secure. Reliable. Trusted.</span>
          <br />
          Your training data is protected with enterprise-grade security.
        </p>
      </div>
    </div>
  );
}
