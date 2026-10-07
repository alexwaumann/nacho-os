import { Briefcase, Sun } from "lucide-react";
import { useState } from "react";

import { Link } from "@tanstack/react-router";

import type { LucideIcon } from "lucide-react";
import { GlobalVoiceButton } from "@/features/voice/components/GlobalVoiceButton";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: "/" | "/jobs";
  icon: LucideIcon;
  label: string;
}

function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <Link
      to={to}
      // Today stays lit with a job open (?job=), but not on other pages
      activeOptions={{ exact: to === "/", includeSearch: false }}
      className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-full text-muted-foreground transition-colors active:scale-95"
      activeProps={{ className: "text-primary", "aria-current": "page" }}
    >
      <Icon size={28} strokeWidth={2.25} />
      <span className="text-sm font-bold leading-none">{label}</span>
    </Link>
  );
}

// Today, the big mic, Jobs. Lives outside the page, so the mic keeps recording across pages.
export default function BottomNav() {
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  return (
    <div
      className={cn(
        "fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-0 right-0 z-50 flex justify-center px-2 pointer-events-none",
        // Above an open job sheet while recording, so he can still stop or discard
        isVoiceActive && "z-60",
      )}
      // Keep taps on the mic from closing a job sheet opened mid-recording
      onPointerDown={(e) => {
        if (isVoiceActive) e.stopPropagation();
      }}
    >
      <nav className="pointer-events-auto grid h-20 w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center rounded-full border border-border bg-card/90 px-4 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/5">
        <NavItem to="/" icon={Sun} label="Today" />
        <GlobalVoiceButton onActiveChange={setIsVoiceActive} className="-translate-y-7 px-3" />
        <NavItem to="/jobs" icon={Briefcase} label="Jobs" />
      </nav>
    </div>
  );
}
