import { useMutation, useQuery } from "convex/react";
import { LogOut, MapPin, Monitor, Moon, Navigation, Pencil, Sun, User, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SignOutButton, useUser } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";
import type { Theme } from "@/lib/theme";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { Label } from "@/components/ui/label";
import { geocodeAddress } from "@/server/geo";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user } = useUser();
  const convexUser = useQuery(api.users.getCurrentUser);
  const updateHomeAddress = useMutation(api.users.updateHomeAddress);

  const { theme, setTheme } = useTheme();
  const [homeAddress, setHomeAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<
    "prompt" | "requesting" | "granted" | "denied"
  >("prompt");

  // Load home address from Convex user
  useEffect(() => {
    if (convexUser?.homeAddress) {
      setHomeAddress(convexUser.homeAddress);
    }
  }, [convexUser]);

  // Check geolocation permission on mount
  useEffect(() => {
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      setGeolocationStatus(status.state);

      status.addEventListener("change", () => {
        setGeolocationStatus(status.state);
      });
    });
  }, []);

  const handleAddressSelect = async (address: string, _placeId: string) => {
    setHomeAddress(address);
    setIsSaving(true);

    try {
      // Geocode the address
      const coords = await geocodeAddress({ data: { address } });

      // Save to Convex
      await updateHomeAddress({
        address,
        coordinates: coords ?? undefined,
      });
    } catch (error) {
      console.error("Failed to save address:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const requestGeolocation = () => {
    setGeolocationStatus("requesting");

    navigator.geolocation.getCurrentPosition(
      () => {
        setGeolocationStatus("granted");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setGeolocationStatus("denied");
      },
      { enableHighAccuracy: true },
    );
  };

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="flex items-center gap-6 p-2">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground border-4 border-card shadow-sm overflow-hidden">
          {user?.imageUrl ?
            <img
              src={user.imageUrl}
              alt={user.fullName || "User"}
              className="w-full h-full object-cover"
            />
          : <User size={40} />}
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground">Account Settings</h2>
          <p className="text-muted-foreground font-bold">Manage your preferences.</p>
        </div>
      </div>

      {/* Appearance Tab Group */}
      <div className="bg-muted p-1.5 rounded-2xl flex items-center justify-between">
        {(
          [
            { id: "light", icon: Sun, label: "Light" },
            { id: "system", icon: Monitor, label: "System" },
            { id: "dark", icon: Moon, label: "Dark" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as Theme)}
            className={`flex-1 py-3 text-center rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${
              theme === t.id ?
                "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Home Settings */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">
          Home Settings
        </h3>

        <div className="space-y-3 px-2">
          <Label className="text-sm font-black text-foreground">Home Address</Label>
          {convexUser?.homeAddress && !isEditing ?
            /* View mode - show saved address with edit button */
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 flex items-center gap-3 h-12 px-4 bg-muted/50 border border-border rounded-xl">
                <MapPin size={20} className="text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground truncate">
                  {convexUser.homeAddress}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setHomeAddress("");
                  setIsEditing(true);
                }}
                className="shrink-0 h-12 w-12"
              >
                <Pencil size={16} />
              </Button>
            </div>
          : /* Edit mode - show address autocomplete with save/cancel buttons */
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <AddressAutocomplete
                  value={homeAddress}
                  autoFocus={isEditing}
                  onSelect={(address, _placeId) => {
                    handleAddressSelect(address, _placeId);
                    setIsEditing(false);
                  }}
                  placeholder="Enter home address..."
                  userCoordinates={convexUser?.homeCoordinates ?? undefined}
                />
              </div>
              {convexUser?.homeAddress && (
                /* Only show cancel button if editing existing address */
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setHomeAddress(convexUser.homeAddress ?? "");
                    setIsEditing(false);
                  }}
                  className="shrink-0 h-12 w-12"
                >
                  <X size={16} />
                </Button>
              )}
            </div>
          }
          <p className="text-xs font-bold text-muted-foreground leading-relaxed">
            Route optimization will start and end from this location.
            {isSaving && <span className="ml-2 text-primary">Saving...</span>}
          </p>

          {/* Location Access - only show if not granted */}
          {geolocationStatus !== "granted" && (
            <div className="pt-4 border-t border-border/50">
              {geolocationStatus === "denied" ?
                <div className="space-y-2">
                  <Label className="text-sm font-black text-foreground">
                    Location Access Denied
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Location access was denied. To enable it, please reset the permission in your
                    browser settings and reload this page.
                  </p>
                </div>
              : <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-black text-foreground">Geolocation</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow access to your current location for nearby job detection.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={requestGeolocation}
                    disabled={geolocationStatus === "requesting"}
                    className="shrink-0"
                  >
                    <Navigation size={16} className="mr-2" />
                    {geolocationStatus === "requesting" ? "Requesting..." : "Request Access"}
                  </Button>
                </div>
              }
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">
          Other Settings
        </h3>

        {/* Auth Actions */}
        <SignOutButton>
          <button className="w-full py-4 bg-card border-2 border-destructive/20 text-destructive rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-destructive/5">
            <LogOut size={20} />
            Sign Out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
