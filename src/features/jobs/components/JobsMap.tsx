import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import {
  Check,
  DollarSign,
  House,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Navigation,
  Route as RouteIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { MapCameraChangedEvent } from "@vis.gl/react-google-maps";
import type { ReactNode } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import { env } from "@/env";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/openExternal";
import { generateGoogleMapsUrl } from "@/server/geo";

type LatLng = { lat: number; lng: number };
type JobStatus = "pending" | "completed" | "paid";

interface JobPin {
  job: Doc<"jobs">;
  position: LatLng;
  // 1-based stop number on today's route; undefined for the other (filtered) jobs
  routeNumber?: number;
}

interface MapCamera {
  center: LatLng;
  zoom: number;
}

// Room for the control stack on the right edge
const FIT_PADDING = { top: 56, right: 88, bottom: 56, left: 56 };
const LOCATE_ZOOM = 15;
// Pins are round, so anchor them at their center instead of the bottom edge
const CENTER_ANCHOR = { anchorLeft: "-50%", anchorTop: "-50%" };
// Dallas, TX when we have nothing better to center on
const DEFAULT_CENTER = { lat: 32.7767, lng: -96.797 };

// Fills the screen under the page header, filter pills and List/Map toggle, and stops above
// the bottom nav (the page's bottom padding) so the page itself never scrolls
const MAP_HEIGHT_CLASS = "h-[calc(100dvh-22rem)] min-h-80";

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
  // The page's status filter; it picks the plain pins. Route stops always show.
  filter: JobStatus;
  onOpenJob: (jobId: Id<"jobs">) => void;
}

/**
 * Map of today's route stops (numbered pins, always shown) plus the jobs matching the
 * page filter (plain pins). Tapping a pin opens the job. Expand opens the same map
 * full screen.
 */
export function JobsMap({ filter, onOpenJob }: JobsMapProps) {
  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY;
  const { data: filteredJobs } = useQuery(convexQuery(api.jobs.list, { status: filter }));
  const { data: routeJobs } = useQuery(convexQuery(api.jobs.getSelectedForRoute, {}));
  const { data: currentUser } = useQuery(convexQuery(api.users.getCurrentUser, {}));
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  // Last camera of whichever map was showing, so switching modes keeps the same view
  const cameraRef = useRef<MapCamera | null>(null);

  useEffect(() => {
    getCurrentPosition()
      .then(setUserLocation)
      .catch((err) => console.warn("Geolocation error:", err));
  }, []);

  // Number stops the same way as the route list on the home page
  const routePins: Array<JobPin> = (routeJobs ?? []).flatMap((job, index) =>
    job.coordinates ? [{ job, position: job.coordinates, routeNumber: index + 1 }] : [],
  );
  // A route stop that also matches the filter shows once, as its numbered pin
  const routeJobIds = new Set((routeJobs ?? []).map((job) => job._id));
  const otherPins: Array<JobPin> = (filteredJobs ?? []).flatMap((job) =>
    !routeJobIds.has(job._id) && job.coordinates ? [{ job, position: job.coordinates }] : [],
  );
  const homeLocation = currentUser?.homeCoordinates ?? null;
  const isLoaded = filteredJobs !== undefined && routeJobs !== undefined;

  const handleNavigate = () => {
    const url = generateGoogleMapsUrl(
      (routeJobs ?? []).map((job) => ({ coordinates: job.coordinates })),
      !!userLocation,
      homeLocation ?? undefined,
    );
    if (url) openExternal(url);
  };

  const handleCameraChange = (camera: MapCamera) => {
    cameraRef.current = camera;
  };

  if (!apiKey) return <MapUnavailable />;

  const canvasProps: JobsMapCanvasProps = {
    routePins,
    otherPins,
    homeLocation,
    userLocation,
    isLoaded,
    initialCamera: cameraRef.current,
    onCameraChange: handleCameraChange,
    onUserLocationChange: setUserLocation,
    onOpenJob,
    onNavigate: handleNavigate,
    isExpanded,
    onExpandedChange: setIsExpanded,
  };

  return (
    <APIProvider apiKey={apiKey}>
      <div
        className={cn(
          "relative w-full bg-muted rounded-3xl overflow-hidden border border-border",
          MAP_HEIGHT_CLASS,
        )}
      >
        {/* Only one map at a time; the inline one comes back where full screen left off */}
        {!isExpanded && <JobsMapCanvas {...canvasProps} />}
      </div>

      {isExpanded && (
        <FullscreenMap onClose={() => setIsExpanded(false)}>
          <JobsMapCanvas {...canvasProps} />
        </FullscreenMap>
      )}
    </APIProvider>
  );
}

interface FullscreenMapProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Covers the whole screen with the map. Rendered as a plain fixed portal (not a modal
 * Dialog) at z-50: it's appended to <body> after the app, so it covers the bottom nav
 * (also z-50), and the job sheet's drawer (z-50) is appended after it when a pin is
 * tapped, so the sheet opens on top. Closing the sheet leaves the full screen map.
 */
function FullscreenMap({ onClose, children }: FullscreenMapProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Lock page scroll behind the map while it's open
  useEffect(() => {
    const { documentElement: html, body } = document;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jobs map, full screen"
      data-slot="jobs-map-fullscreen"
      className="fixed inset-0 z-50 h-dvh w-dvw overscroll-none bg-muted"
    >
      {children}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close full screen map"
        title="Close full screen map"
        className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xl transition-transform hover:bg-muted active:scale-95"
      >
        <X size={30} strokeWidth={2.5} />
      </button>
    </div>,
    document.body,
  );
}

interface JobsMapCanvasProps {
  routePins: Array<JobPin>;
  otherPins: Array<JobPin>;
  homeLocation: LatLng | null;
  userLocation: LatLng | null;
  // Both job queries have answered, so the first auto-fit sees the whole route
  isLoaded: boolean;
  // Where to start; when missing, the map frames the route once the jobs load
  initialCamera: MapCamera | null;
  onCameraChange: (camera: MapCamera) => void;
  onUserLocationChange: (location: LatLng) => void;
  onOpenJob: (jobId: Id<"jobs">) => void;
  onNavigate: () => void;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}

// The map, its pins and the control stack. Shared by the inline and full screen modes.
function JobsMapCanvas({
  routePins,
  otherPins,
  homeLocation,
  userLocation,
  isLoaded,
  initialCamera,
  onCameraChange,
  onUserLocationChange,
  onOpenJob,
  onNavigate,
  isExpanded,
  onExpandedChange,
}: JobsMapCanvasProps) {
  // Read once: later camera moves are reported back up and mustn't cancel the first auto-fit
  const [startCamera] = useState(initialCamera);
  const allPoints = [...routePins, ...otherPins].map((pin) => pin.position);
  // Fit frames today's route; with no route, every pin on the map
  const fitPoints = routePins.length > 0 ? routePins.map((pin) => pin.position) : allPoints;
  const fallbackCenter =
    allPoints.length > 0 ? averagePoint(allPoints) : (homeLocation ?? DEFAULT_CENTER);

  const handleCameraChanged = (event: MapCameraChangedEvent) => {
    onCameraChange({ center: event.detail.center, zoom: event.detail.zoom });
  };

  return (
    <>
      <Map
        defaultCenter={startCamera?.center ?? fallbackCenter}
        defaultZoom={startCamera?.zoom ?? (allPoints.length > 0 ? 11 : 10)}
        mapId="nacho-os-map"
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        onCameraChanged={handleCameraChanged}
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
        fitPoints={fitPoints}
        isFittingRoute={routePins.length > 0}
        shouldAutoFit={!startCamera && isLoaded}
        userLocation={userLocation}
        onUserLocationChange={onUserLocationChange}
        canNavigate={routePins.length > 0}
        onNavigate={onNavigate}
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
      />
    </>
  );
}

function averagePoint(points: Array<LatLng>): LatLng {
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

// Plain pins: pending is solid slate, completed a muted green check, paid a faded grey $
const STATUS_PIN_STYLES: Record<JobStatus, { className: string; icon?: ReactNode }> = {
  pending: { className: "bg-slate-600" },
  completed: { className: "bg-emerald-600/80", icon: <Check size={16} strokeWidth={3.5} /> },
  paid: { className: "bg-slate-400/90", icon: <DollarSign size={16} strokeWidth={3} /> },
};

interface JobMarkerProps {
  pin: JobPin;
  onOpenJob: (jobId: Id<"jobs">) => void;
}

function JobMarker({ pin, onOpenJob }: JobMarkerProps) {
  const isOnRoute = pin.routeNumber !== undefined;
  // Route pins draw above other jobs, with lower stop numbers on top
  const zIndex = pin.routeNumber !== undefined ? 1000 - pin.routeNumber : 10;
  const statusStyle = STATUS_PIN_STYLES[pin.job.status];

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
        : <div
            className={cn(
              "w-8 h-8 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center text-white",
              statusStyle.className,
            )}
          >
            {statusStyle.icon}
          </div>
        }
      </div>
    </AdvancedMarker>
  );
}

interface MapControlsProps {
  fitPoints: Array<LatLng>;
  isFittingRoute: boolean;
  shouldAutoFit: boolean;
  userLocation: LatLng | null;
  onUserLocationChange: (location: LatLng) => void;
  canNavigate: boolean;
  onNavigate: () => void;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}

function MapControls({
  fitPoints,
  isFittingRoute,
  shouldAutoFit,
  userLocation,
  onUserLocationChange,
  canNavigate,
  onNavigate,
  isExpanded,
  onExpandedChange,
}: MapControlsProps) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoFitRef = useRef(false);

  const fitToPoints = () => {
    if (!map || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      map.panTo(fitPoints[0]);
      map.setZoom(LOCATE_ZOOM);
      return;
    }
    const lats = fitPoints.map((point) => point.lat);
    const lngs = fitPoints.map((point) => point.lng);
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

  // Frame the route once the map and the jobs are both loaded
  useEffect(() => {
    if (!map || !shouldAutoFit || fitPoints.length === 0 || hasAutoFitRef.current) return;
    hasAutoFitRef.current = true;
    fitToPoints();
  });

  const handleFit = () => {
    if (fitPoints.length === 0) {
      toast.info("No jobs on the map");
      return;
    }
    fitToPoints();
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

  // Top right, clear of the Google logo and terms links along the bottom edge
  return (
    <div
      className={cn(
        "absolute right-3 flex flex-col gap-3",
        isExpanded ? "top-[max(0.75rem,env(safe-area-inset-top))]" : "top-3",
      )}
    >
      <MapButton onClick={handleLocateMe} disabled={!map} label="Go to my location">
        <LocateFixed size={26} className={cn(isLocating && "animate-pulse text-primary")} />
      </MapButton>
      <MapButton
        onClick={handleFit}
        disabled={!map}
        label={isFittingRoute ? "Show today's route" : "Show all jobs on the map"}
      >
        <RouteIcon size={26} />
      </MapButton>
      <MapButton
        onClick={onNavigate}
        disabled={!canNavigate}
        label="Navigate today's route in Google Maps"
        isPrimary
      >
        <Navigation size={24} fill="currentColor" />
      </MapButton>
      <MapButton
        onClick={() => onExpandedChange(!isExpanded)}
        label={isExpanded ? "Exit full screen" : "Full screen map"}
      >
        {isExpanded ?
          <Minimize2 size={26} />
        : <Maximize2 size={26} />}
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
        "h-14 w-14 rounded-full shadow-xl border flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed",
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
