import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { LocateFixed, Map as MapIcon, Navigation, Route as RouteIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { env } from "@/env";
import { cn } from "@/lib/utils";
import { generateGoogleMapsUrl } from "@/server/geo";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

type LatLng = { lat: number; lng: number };

const ROUTE_PADDING = { top: 140, right: 96, bottom: 48, left: 48 };
const LOCATE_ZOOM = 15;

function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

function getGeolocationErrorMessage(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) {
      return "Location permission is blocked. Allow it in your browser settings.";
    }
    if (error.code === error.TIMEOUT) return "Timed out finding your location.";
    return "Your location is unavailable right now.";
  }
  return error instanceof Error ? error.message : "Unknown error";
}

function MapPage() {
  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY;
  const { data: selectedJobs = [] } = useQuery(convexQuery(api.jobs.getSelectedForRoute, {}));
  const { data: currentUser } = useQuery(convexQuery(api.users.getCurrentUser, {}));
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const stops = selectedJobs.flatMap((job) => (job.coordinates ? [job.coordinates] : []));

  // Get user location
  useEffect(() => {
    getCurrentPosition()
      .then(setUserLocation)
      .catch((err) => console.warn("Geolocation error:", err));
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

  // Calculate center based on jobs or user location
  const center = (() => {
    if (stops.length > 0) {
      const avgLat = stops.reduce((sum, c) => sum + c.lat, 0) / stops.length;
      const avgLng = stops.reduce((sum, c) => sum + c.lng, 0) / stops.length;
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

        {/* Job List Overlay */}
        {selectedJobs.length > 0 && (
          <div className="absolute top-4 left-4 right-4">
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-lg py-0">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <RouteIcon size={16} className="text-primary" />
                  {selectedJobs.length} stop{selectedJobs.length !== 1 ? "s" : ""} selected
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <MapControls
          stops={stops}
          userLocation={userLocation}
          onUserLocationChange={setUserLocation}
          canNavigate={selectedJobs.length > 0}
          onNavigate={handleNavigate}
        />
      </APIProvider>
    </div>
  );
}

interface MapControlsProps {
  stops: Array<LatLng>;
  userLocation: LatLng | null;
  onUserLocationChange: (location: LatLng) => void;
  canNavigate: boolean;
  onNavigate: () => void;
}

function MapControls({
  stops,
  userLocation,
  onUserLocationChange,
  canNavigate,
  onNavigate,
}: MapControlsProps) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoFitRef = useRef(false);

  const fitRoute = (includeUserLocation: boolean) => {
    if (!map || stops.length === 0) return;
    const points = includeUserLocation && userLocation ? [...stops, userLocation] : stops;
    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(LOCATE_ZOOM);
      return;
    }
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      ROUTE_PADDING,
    );
  };

  // Frame the route once the map and selected stops are both loaded
  useEffect(() => {
    if (!map || stops.length === 0 || hasAutoFitRef.current) return;
    hasAutoFitRef.current = true;
    fitRoute(false);
  });

  const handleShowRoute = () => {
    if (stops.length === 0) {
      toast.info("No stops with a location selected");
      return;
    }
    fitRoute(true);
  };

  const handleLocateMe = async () => {
    if (!map) return;
    // Pan right away to the last known position while we fetch a fresh one
    if (userLocation) map.panTo(userLocation);
    setIsLocating(true);
    try {
      const location = await getCurrentPosition();
      onUserLocationChange(location);
      map.panTo(location);
      map.setZoom(Math.max(map.getZoom() ?? 0, LOCATE_ZOOM));
    } catch (error) {
      console.error("Geolocation failed:", error);
      toast.error("Couldn't get your location", {
        description: getGeolocationErrorMessage(error),
      });
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="absolute right-4 bottom-4 flex flex-col gap-3">
      <button
        onClick={onNavigate}
        disabled={!canNavigate}
        aria-label="Open route in Google Maps"
        className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-primary active:scale-90 transition-transform hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Navigation size={28} fill="currentColor" className="opacity-80" />
      </button>
      <button
        onClick={handleShowRoute}
        disabled={!map}
        aria-label="Show whole route"
        className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-primary active:scale-90 transition-transform hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RouteIcon size={28} />
      </button>
      <button
        onClick={handleLocateMe}
        disabled={!map}
        aria-label="Go to my location"
        className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <LocateFixed size={28} className={cn(isLocating && "animate-pulse text-primary")} />
      </button>
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
