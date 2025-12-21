import { useMutation, useQuery } from "convex/react";
import { LogOut, MapPin, Navigation, User } from "lucide-react";
import { useEffect, useState } from "react";

import { SignOutButton, useUser } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { geocodeAddress } from "@/server/geo";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user } = useUser();
  const convexUser = useQuery(api.users.getCurrentUser);
  const updateHomeAddress = useMutation(api.users.updateHomeAddress);

  const [homeAddress, setHomeAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");

  // Load home address from Convex user
  useEffect(() => {
    if (convexUser?.homeAddress) {
      setHomeAddress(convexUser.homeAddress);
    }
  }, [convexUser]);

  const handleAddressSelect = async (address: string, placeId: string) => {
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
      (pos) => {
        setGeolocationStatus("granted");
        // Could optionally reverse geocode and set as home address
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

      {/* Depot Settings */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">
          Depot Settings
        </h3>

        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-black text-foreground">Home / Depot Address</Label>
              <AddressAutocomplete
                value={homeAddress}
                onSelect={handleAddressSelect}
                placeholder="Enter start/end location..."
                userCoordinates={convexUser?.homeCoordinates ?? undefined}
              />
            </div>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed">
              Route optimization will start and end from this location.
              {isSaving && <span className="ml-2 text-primary">Saving...</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Location Permissions */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">
          Location Access
        </h3>

        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-black text-foreground">Geolocation</Label>
                <p className="text-xs text-muted-foreground">
                  Allow access to your current location for nearby job detection.
                </p>
              </div>
              <Button
                variant={geolocationStatus === "granted" ? "secondary" : "outline"}
                onClick={requestGeolocation}
                disabled={geolocationStatus === "requesting"}
                className="shrink-0"
              >
                {geolocationStatus === "granted" ?
                  <>
                    <Navigation size={16} className="mr-2" />
                    Granted
                  </>
                : geolocationStatus === "denied" ?
                  <>
                    <MapPin size={16} className="mr-2" />
                    Denied
                  </>
                : <>
                    <MapPin size={16} className="mr-2" />
                    Request
                  </>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appearance Settings */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">
          Appearance
        </h3>

        <Card className="border-none shadow-sm bg-card overflow-hidden">
          <CardContent className="p-1.5">
            <ThemeToggle />
          </CardContent>
        </Card>
      </div>

      {/* Auth Actions */}
      <div className="pt-4 px-2">
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
