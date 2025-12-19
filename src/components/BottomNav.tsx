import { Link } from "@tanstack/react-router";
import { Bot, Briefcase, Map as MapIcon, UserCircle } from "lucide-react";

export default function BottomNav() {
  const navItems = [
    { to: "/", icon: Bot, label: "You" },
    { to: "/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/map", icon: MapIcon, label: "Map" },
    { to: "/account", icon: UserCircle, label: "Account" },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <nav className="bg-card/90 backdrop-blur-xl shadow-2xl border border-border rounded-full px-8 py-4 flex gap-8 items-center pointer-events-auto ring-1 ring-black/5 dark:ring-white/5">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center justify-center transition-all duration-300 text-muted-foreground hover:text-foreground active:scale-90"
            activeProps={{
              className: "text-primary scale-110 drop-shadow-sm",
            }}
          >
            <item.icon size={28} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
