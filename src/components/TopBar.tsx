import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Triangle, UserCircle } from "lucide-react";

import { useUser } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import { cn } from "@/lib/utils";

const NachoLogo = ({ size = 24 }: { size?: number }) => (
  <div className="relative flex items-center justify-center">
    {/* Literal Nacho (Triangle) */}
    <Triangle
      size={size}
      className="text-amber-500 fill-amber-400 rotate-180 drop-shadow-sm"
      strokeWidth={2.5}
    />
    {/* OS "Chip" dot */}
    <div className="absolute -bottom-0.5 w-1.5 h-1.5 bg-sky-500 rounded-full border border-white dark:border-slate-900" />
  </div>
);

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Today";
  if (pathname.startsWith("/jobs")) return "Jobs";
  if (pathname.startsWith("/account")) return "Account";
  return "Nacho OS";
}

// Page title on the left, his picture on the right (opens Account)
export default function TopBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: currentUser } = useQuery(convexQuery(api.users.getCurrentUser, {}));
  const { user } = useUser();
  const imageUrl = currentUser?.imageUrl ?? user?.imageUrl;
  const isAccount = pathname.startsWith("/account");

  return (
    <header className="sticky top-0 z-40 w-full pointer-events-none">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3 px-4 pt-5 pb-3">
        <Link
          to="/"
          className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-full border border-border bg-card/80 px-5 shadow-sm backdrop-blur-md"
        >
          <NachoLogo size={24} />
          <h1 className="text-xl font-black tracking-tight text-foreground">
            {getPageTitle(pathname)}
          </h1>
        </Link>
        <Link
          to="/account"
          aria-label="Account"
          aria-current={isAccount ? "page" : undefined}
          className={cn(
            "pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-card shadow-sm active:scale-95",
            isAccount ? "border-primary ring-2 ring-primary/30" : "border-border",
          )}
        >
          {imageUrl ?
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          : <UserCircle size={30} className="text-muted-foreground" />}
        </Link>
      </div>
    </header>
  );
}
