export function LoginFooter() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-2 border-t border-[#E2E8F0] pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <p className="text-xs font-semibold text-[#172033]">FRONT OFFICE SERVICING NC II</p>
        <p className="text-[11px] text-[#64748B]">Training & Operations Management System</p>
      </div>
      <p className="text-[11px] text-[#64748B]">© {new Date().getFullYear()} Front Office Training Center. All rights reserved.</p>
    </footer>
  );
}
