import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { House, LocateFixed, Map as MapIcon, Maximize2, Navigation } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { ReactNode } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import { env } from "@/env";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/openExternal";
import { generateGoogleMapsUrl } from "@/server/geo";

type LatLng = { lat: number; lng: number };

interface JobPin {
  job: Doc<"jobs">;
  position: LatLng;
  // 1-based stop number on today's route; undefined for other pending jobs
  routeNumber?: number;
}

// Room for the control bar near the bottom of the map
const FIT_PADDING = { top: 48, right: 48, bottom: 120, left: 48 };
const LOCATE_ZOOM = 15;
// Pins are round, so anchor them at their center instead of the bottom edge
const CENTER_ANCHOR = { anchorLeft: "-50%", anchorTop: "-50%" };
// Dallas, TX when we have nothing better to center on
const DEFAULT_CENTER = { lat: 32.7767, lng: -96.797 };

// Fills the screen under the page header, filter pills, view toggle, and bottom nav
const MAP_HEIGHT_CLASS = "h-[calc(100dvh-26.5rem)] min-h-80";

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

interface JobsMapProps {
  onOpenJob: (jobId: Id<"jobs">) => void;
  // True when the page filter is Completed or Paid, which the map ignores
  isFilterIgnored?: boolean;
}

/**
 * Map of every pending job. Today's route stops get numbered primary pins;
 * other pending jobs get plain grey pins. Tapping a pin opens the job.
 */
export function JobsMap({ onOpenJob, isFilterIgnored = false }: JobsMapProps) {
  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY;
  const { data: pendingJobs = [] } = useQuery(convexQuery(api.jobs.list, { status: "pending" }));
  const { data: routeJobs = [] } = useQuery(convexQuery(api.jobs.getSelectedForRoute, {}));
  const { data: currentUser } = useQuery(convexQuery(api.users.getCurrentUser, {}));
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    getCurrentPosition()
      .then(setUserLocation)
      .catch((err) => console.warn("Geolocation error:", err));
  }, []);

  // Number stops the same way as the route list on the home page
  const routePins: Array<JobPin> = routeJobs.flatMap((job, index) =>
    job.coordinates ? [{ job, position: job.coordinates, routeNumber: index + 1 }] : [],
  );
  const otherPins: Array<JobPin> = pendingJobs.flatMap((job) =>
    !job.selectedForRoute && job.coordinates ? [{ job, position: job.coordinates }] : [],
  );
  const jobPoints = [...routePins, ...otherPins].map((pin) => pin.position);
  const homeLocation = currentUser?.homeCoordinates ?? null;
  const unmappedCount = pendingJobs.filter((job) => !job.coordinates).length;

  const handleNavigate = () => {
    const url = generateGoogleMapsUrl(
      routeJobs.map((job) => ({ coordinates: job.coordinates })),
      !!userLocation,
      homeLocation ?? undefined,
    );
    if (url) openExternal(url);
  };

  const center = jobPoints.length > 0 ? averagePoint(jobPoints) : (homeLocation ?? DEFAULT_CENTER);

  if (!apiKey) return <MapUnavailable />;

  return (
    <div className="space-y-2">
      <p className="text-base text-muted-foreground font-medium px-1 leading-snug">
        {isFilterIgnored ?
          "The map shows pending jobs. Numbered pins are today's route."
        : "Numbered pins are today's route. Tap a pin to open the job."}
        {unmappedCount > 0 &&
          ` ${unmappedCount} job${unmappedCount !== 1 ? "s have" : " has"} no map location.`}
      </p>

      <div
        className={cn(
          "relative w-full bg-muted rounded-3xl overflow-hidden border border-border",
          MAP_HEIGHT_CLASS,
        )}
      >
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={jobPoints.length > 0 ? 11 : 10}
            mapId="nacho-os-map"
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
            className="w-full h-full"
          >
            {homeLocation && (
              <AdvancedMarker position={homeLocation} title="Home" zIndex={1} {...CENTER_ANCHOR}>
                <div className="w-10 h-10 rounded-full bg-card text-foreground border-2 border-foreground/70 shadow-lg flex items-center justify-center">
                  <House size={20} />
                </div>
              </AdvancedMarker>
            )}

            {userLocation && (
              <AdvancedMarker
                position={userLocation}
                title="You are here"
                zIndex={2}
                {...CENTER_ANCHOR}
              >
                <div className="w-6 h-6 rounded-full bg-sky-500 border-4 border-white shadow-lg animate-pulse" />
              </AdvancedMarker>
            )}

            {otherPins.map((pin) => (
              <JobMarker key={pin.job._id} pin={pin} onOpenJob={onOpenJob} />
            ))}
            {routePins.map((pin) => (
              <JobMarker key={pin.job._id} pin={pin} onOpenJob={onOpenJob} />
            ))}
          </Map>

          <MapControls
            jobPoints={jobPoints}
            userLocation={userLocation}
            onUserLocationChange={setUserLocation}
            canNavigate={routePins.length > 0}
            onNavigate={handleNavigate}
          />
        </APIProvider>
      </div>
    </div>
  );
}

function averagePoint(points: Array<LatLng>): LatLng {
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

interface JobMarkerProps {
  pin: JobPin;
  onOpenJob: (jobId: Id<"jobs">) => void;
}

function JobMarker({ pin, onOpenJob }: JobMarkerProps) {
  const isOnRoute = pin.routeNumber !== undefined;
  // Route pins draw above other jobs, with lower stop numbers on top
  const zIndex = pin.routeNumber !== undefined ? 1000 - pin.routeNumber : 10;

  return (
    <AdvancedMarker
      position={pin.position}
      title={isOnRoute ? `Stop ${pin.routeNumber}: ${pin.job.address}` : pin.job.address}
      zIndex={zIndex}
      {...CENTER_ANCHOR}
      onClick={() => onOpenJob(pin.job._id)}
    >
      {/* 48px tap area around every pin */}
      <div className="w-12 h-12 flex items-center justify-center cursor-pointer">
        {isOnRoute ?
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground border-[3px] border-white shadow-xl flex items-center justify-center text-xl font-black">
            {pin.routeNumber}
          </div>
        : <div className="w-8 h-8 rounded-full bg-slate-500 border-[3px] border-white shadow-lg" />}
      </div>
    </AdvancedMarker>
  );
}

interface MapControlsProps {
  jobPoints: Array<LatLng>;
  userLocation: LatLng | null;
  onUserLocationChange: (location: LatLng) => void;
  canNavigate: boolean;
  onNavigate: () => void;
}

function MapControls({
  jobPoints,
  userLocation,
  onUserLocationChange,
  canNavigate,
  onNavigate,
}: MapControlsProps) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoFitRef = useRef(false);

  const fitAllJobs = () => {
    if (!map || jobPoints.length === 0) return;
    if (jobPoints.length === 1) {
      map.panTo(jobPoints[0]);
      map.setZoom(LOCATE_ZOOM);
      return;
    }
    const lats = jobPoints.map((point) => point.lat);
    const lngs = jobPoints.map((point) => point.lng);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      FIT_PADDING,
    );
  };

  // Frame all jobs once the map and the jobs are both loaded
  useEffect(() => {
    if (!map || jobPoints.length === 0 || hasAutoFitRef.current) return;
    hasAutoFitRef.current = true;
    fitAllJobs();
  });

  const handleFitAll = () => {
    if (jobPoints.length === 0) {
      toast.info("No pending jobs on the map");
      return;
    }
    fitAllJobs();
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

  // Sits above the Google logo and terms links, which must stay visible
  return (
    <div className="absolute inset-x-3 bottom-8 grid grid-cols-[1fr_1fr_1.3fr] gap-2">
      <MapButton onClick={handleLocateMe} disabled={!map} label="Go to my location">
        <LocateFixed size={20} className={cn(isLocating && "animate-pulse text-primary")} />
        Me
      </MapButton>
      <MapButton onClick={handleFitAll} disabled={!map} label="Show all jobs">
        <Maximize2 size={20} />
        All jobs
      </MapButton>
      <MapButton
        onClick={onNavigate}
        disabled={!canNavigate}
        label="Navigate today's route in Google Maps"
        isPrimary
      >
        <Navigation size={20} fill="currentColor" />
        Navigate
      </MapButton>
    </div>
  );
}

interface MapButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  isPrimary?: boolean;
  children: ReactNode;
}

function MapButton({ onClick, disabled, label, isPrimary, children }: MapButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "h-14 rounded-2xl shadow-xl border flex items-center justify-center gap-1.5 px-1 whitespace-nowrap text-base font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed",
        isPrimary ?
          "bg-primary text-primary-foreground border-primary"
        : "bg-card text-foreground border-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function MapUnavailable() {
  return (
    <div
      className={cn(
        "w-full bg-muted rounded-3xl border border-border flex flex-col items-center justify-center p-8 text-center gap-4",
        MAP_HEIGHT_CLASS,
      )}
    >
      <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center shadow-sm border border-border text-muted-foreground/50">
        <MapIcon size={32} />
      </div>
      <h2 className="text-xl font-black text-foreground">The map isn't set up</h2>
      <p className="text-muted-foreground font-medium text-base max-w-[280px]">
        The Google Maps key is missing (VITE_GOOGLE_MAPS_API_KEY). Use the List view for now.
      </p>
    </div>
  );
}
