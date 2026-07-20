import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function NavBar({ active }: { active: "home" | "admin" }) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/30">
          <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" strokeWidth={2}>
            <path
              d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[15px] font-semibold tracking-tight">정보 크롤링 트래커</span>
      </Link>

      <nav className="flex items-center gap-1 rounded-xl border border-neutral-200/80 bg-white/60 p-1 text-sm shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60">
        <Link
          href="/"
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            active === "home"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          피드
        </Link>
        <Link
          href="/admin"
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            active === "admin"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          관리
        </Link>
        <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <LogoutButton />
      </nav>
    </header>
  );
}
