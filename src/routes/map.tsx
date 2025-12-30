import { APIProvider, AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { LocateFixed, Map as MapIcon, Navigation, Route as RouteIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { env } from "@/env";
import { generateGoogleMapsUrl } from "@/server/geo";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

type Job = Doc<"jobs">;

function MapPage() {
  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY;
  const selectedJobs = useQuery(api.jobs.getSelectedForRoute) ?? [];
  const currentUser = useQuery(api.users.getCurrentUser);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.warn("Geolocation error:", err),
      { enableHighAccuracy: true },
    );
  }, []);

  const handleNavigate = () => {
    if (selectedJobs.length === 0) return;

    const waypoints = selectedJobs
      .filter((j) => j.coordinates)
      .map((j) => ({
        coordinates: j.coordinates!,
      }));

    const url = generateGoogleMapsUrl(
      waypoints,
      !!userLocation,
      currentUser?.homeCoordinates ?? undefined,
    );
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleLocateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.warn("Geolocation error:", err),
      { enableHighAccuracy: true },
    );
  };

  // Calculate center based on jobs or user location
  const center = (() => {
    const jobsWithCoords = selectedJobs.filter((j) => j.coordinates);
    if (jobsWithCoords.length > 0) {
      const avgLat =
        jobsWithCoords.reduce((sum, j) => sum + j.coordinates!.lat, 0) / jobsWithCoords.length;
      const avgLng =
        jobsWithCoords.reduce((sum, j) => sum + j.coordinates!.lng, 0) / jobsWithCoords.length;
      return { lat: avgLat, lng: avgLng };
    }
    if (userLocation) return userLocation;
    // Default to Dallas, TX
    return { lat: 32.7767, lng: -96.797 };
  })();

  if (!apiKey) {
    return <MapUnavailable />;
  }

  return (
    <div className="relative h-[calc(100vh-200px)] w-full bg-muted rounded-3xl overflow-hidden">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={selectedJobs.length > 0 ? 11 : 10}
          mapId="nacho-os-map"
          gestureHandling="greedy"
          disableDefaultUI
          className="w-full h-full"
        >
          {/* User Location Marker */}
          {userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="w-6 h-6 rounded-full bg-primary border-4 border-white shadow-lg animate-pulse" />
            </AdvancedMarker>
          )}

          {/* Job Markers */}
          {selectedJobs.map((job, index) =>
            job.coordinates ?
              <AdvancedMarker key={job._id} position={job.coordinates}>
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg border-2 border-white">
                  {index + 1}
                </div>
              </AdvancedMarker>
            : null,
          )}
        </Map>
      </APIProvider>

      {/* Job List Overlay */}
      {selectedJobs.length > 0 && (
        <div className="absolute top-4 left-4 right-4">
          <Card className="bg-card/95 backdrop-blur-sm border-border shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <RouteIcon size={16} className="text-primary" />
                {selectedJobs.length} stop{selectedJobs.length !== 1 ? "s" : ""} selected
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-3">
        <button
          onClick={handleNavigate}
          disabled={selectedJobs.length === 0}
          className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-primary active:scale-90 transition-transform hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Navigation size={28} fill="currentColor" className="opacity-80" />
        </button>
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-primary active:scale-90 transition-transform hover:bg-muted">
          <RouteIcon size={28} />
        </button>
        <button
          onClick={handleLocateMe}
          className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform hover:bg-muted"
        >
          <LocateFixed size={28} />
        </button>
      </div>
    </div>
  );
}

function MapUnavailable() {
  return (
    <div className="relative h-[calc(100vh-200px)] w-full bg-muted rounded-3xl overflow-hidden flex flex-col items-center justify-center p-8 text-center space-y-4 border border-border">
      <div className="space-y-4 max-w-[280px] animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-border text-muted-foreground/50">
          <MapIcon size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
            Map Unavailable
          </h2>
          <p className="text-muted-foreground font-bold leading-snug text-sm">
            Google Maps API Key is not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your
            environment.
          </p>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-3">
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-muted-foreground cursor-not-allowed opacity-50">
          <Navigation size={28} fill="currentColor" className="opacity-80" />
        </button>
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-muted-foreground cursor-not-allowed opacity-50">
          <RouteIcon size={28} />
        </button>
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-muted-foreground cursor-not-allowed opacity-50">
          <LocateFixed size={28} />
        </button>
      </div>
    </div>
  );
}
