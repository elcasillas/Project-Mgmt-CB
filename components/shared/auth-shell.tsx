import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/data/constants";

export function AuthShell({
  title,
  description,
  heroTitle = "Project execution with the clarity of an executive operating rhythm.",
  showLogo = false,
  showMobileLogo = false,
  children
}: {
  title: string;
  description?: string;
  heroTitle?: string;
  showLogo?: boolean;
  showMobileLogo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <div className="hidden flex-1 flex-col justify-between bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.35),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] p-12 lg:flex">
        <div>
          <Image src={logo} alt="Casibros" className="h-auto w-[180px]" priority />
          <h1 className="mt-8 max-w-md text-5xl font-semibold tracking-tight">{heroTitle}</h1>
          <p className="mt-4 max-w-lg text-base text-slate-300">Plan, Prioritize, and Deliver Work</p>
        </div>
        <div className="grid grid-cols-1 justify-center">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-base leading-7 text-slate-200">
              Transforming undervalued homes into high-quality, modern living spaces that elevate neighborhoods and
              deliver lasting value to homeowners and communities.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-slate-900 sm:p-8">
          <div className="mb-6 sm:mb-8">
            {showMobileLogo ? (
              <div className="mb-6 flex justify-center lg:hidden">
                <Image src="/casibros-white.png" alt="Casibros" width={4775} height={1842} className="h-12 w-auto invert sm:h-14" priority />
              </div>
            ) : null}
            <Link href="/" className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">
              {APP_NAME}
            </Link>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2>
            {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
          </div>
          {showLogo ? (
            <div className="mb-6 flex justify-center">
              <Image src="/casibros-white.png" alt="Casibros" width={4775} height={1842} className="h-[66px] w-auto invert sm:h-[72px]" priority />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
