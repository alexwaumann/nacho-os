import { createFileRoute } from "@tanstack/react-router";
import { Navigation, Route as RouteIcon, LocateFixed, Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <div className="relative h-[calc(100vh-200px)] w-full bg-muted rounded-3xl overflow-hidden flex flex-col items-center justify-center p-8 text-center space-y-4 border border-border">
      {/* Map Unavailable UI */}
      <div className="space-y-4 max-w-[280px] animate-in fade-in zoom-in duration-500">
        <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-border text-muted-foreground/50">
          <MapIcon size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
            Map Unavailable
          </h2>
          <p className="text-muted-foreground font-bold leading-snug text-sm">
            Please enter a valid Google Maps API Key in Settings.
          </p>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-3">
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-primary active:scale-90 transition-transform hover:bg-muted">
          <Navigation size={28} fill="currentColor" className="opacity-80" />
        </button>
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-primary active:scale-90 transition-transform hover:bg-muted">
          <RouteIcon size={28} />
        </button>
        <button className="w-14 h-14 rounded-full bg-card shadow-xl border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform hover:bg-muted">
          <LocateFixed size={28} />
        </button>
      </div>
    </div>
  );
}
