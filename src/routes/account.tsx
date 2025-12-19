import { createFileRoute } from "@tanstack/react-router";
import { SignOutButton, useUser } from "@clerk/clerk-react";
import { User, MapPin, Send, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user } = useUser();

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="flex items-center gap-6 p-2">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-4 border-white shadow-sm overflow-hidden">
          {user?.imageUrl ?
            <img
              src={user.imageUrl}
              alt={user.fullName || "User"}
              className="w-full h-full object-cover"
            />
          : <User size={40} />}
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900">Account Settings</h2>
          <p className="text-gray-500 font-bold">Manage your keys and preferences.</p>
        </div>
      </div>

      {/* Depot Settings */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">
          Depot Settings
        </h3>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-black text-gray-900">Home / Depot Address</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <MapPin size={20} />
                </div>
                <ShadcnInput
                  placeholder="Enter start/end location..."
                  className="pl-10 pr-10 py-6 bg-gray-50/50 border-gray-100 rounded-xl font-bold focus-visible:ring-blue-500 focus-visible:border-blue-500"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 cursor-pointer">
                  <Send size={20} />
                </div>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-400 leading-relaxed">
              Route optimization will start and end from this location.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Appearance Settings */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">
          Appearance
        </h3>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-1.5 flex gap-2">
            {[
              { id: "light", icon: Sun, label: "Light" },
              { id: "system", icon: Monitor, label: "System" },
              { id: "dark", icon: Moon, label: "Dark" },
            ].map((theme) => (
              <button
                key={theme.id}
                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
                  theme.id === "system" ?
                    "bg-blue-50 text-blue-600 border border-blue-100"
                  : "text-gray-400 hover:bg-gray-50"
                }`}
              >
                <theme.icon size={20} />
                <span className="text-xs font-black uppercase tracking-wider">{theme.label}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Auth Actions */}
      <div className="pt-4 px-2">
        <SignOutButton>
          <button className="w-full py-4 bg-white border-2 border-red-50 text-red-500 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
            <LogOut size={20} />
            Sign Out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
