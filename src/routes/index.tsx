import { useMutation, useQuery } from "convex/react";
import { ClipboardList, GripVertical, MapPin, Navigation, Plus, Scan } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { AddJobModal } from "@/features/jobs/components/AddJobModal";
import { generateGoogleMapsUrl } from "@/server/geo";

const searchSchema = z.object({
  "new-job": z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: YouPage,
});

function YouPage() {
  const navigate = Route.useNavigate();

  // Sync user on first load
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute);

  useEffect(() => {
    getOrCreateUser().catch(console.error);
  }, [getOrCreateUser]);

  const selectedJobs = useQuery(api.jobs.getSelectedForRoute) ?? [];
  const stats = useQuery(api.jobs.getStats);

  const handleAddJobClick = () => {
    navigate({
      search: (prev) => ({ ...prev, "new-job": "true" }),
    });
  };

  const handleRemoveFromRoute = async (jobId: Id<"jobs">) => {
    await toggleSelectedForRoute({ jobId, selected: false });
  };

  const handleNavigate = () => {
    if (selectedJobs.length === 0) return;

    const waypoints = selectedJobs
      .filter((j) => j.coordinates)
      .map((j) => ({
        coordinates: j.coordinates!,
      }));

    const url = generateGoogleMapsUrl(waypoints, true);
    if (url) {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <AddJobModal />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-6">
        <Card
          onClick={handleAddJobClick}
          className="border border-border shadow-sm bg-card active:scale-95 transition-transform cursor-pointer group"
        >
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Plus size={32} strokeWidth={3} />
            </div>
            <span className="font-bold text-foreground">Add Job</span>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card active:scale-95 transition-transform cursor-pointer group">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <Scan size={32} strokeWidth={3} />
            </div>
            <span className="font-bold text-foreground">Add Check</span>
          </CardContent>
        </Card>
      </div>

      {/* Today's Plan */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <ClipboardList size={24} className="text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">Today's Plan</h2>
          </div>
          {selectedJobs.length > 0 && (
            <button
              onClick={handleNavigate}
              className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <Navigation size={16} />
              Navigate
            </button>
          )}
        </div>

        {selectedJobs.length === 0 ?
          <Card className="border-2 border-dashed border-border bg-card/50 shadow-none rounded-2xl">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-muted-foreground font-medium">No stops planned.</p>
              <button
                onClick={() => navigate({ to: "/jobs" })}
                className="text-primary font-bold hover:underline text-sm"
              >
                Tap to add stops +
              </button>
            </CardContent>
          </Card>
        : <div className="space-y-3">
            {selectedJobs.map((job, index) => (
              <Card
                key={job._id}
                className="border border-border shadow-sm bg-card overflow-hidden"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="cursor-grab text-muted-foreground">
                    <GripVertical size={20} />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground text-sm uppercase truncate">
                      <MapPin className="inline-block w-3 h-3 mr-1 -mt-0.5" />
                      {job.address}
                    </h4>
                    {job.travelTime && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {job.travelTime} • {job.distance}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveFromRoute(job._id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-2"
                  >
                    ✕
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Pending
              </p>
              <p className="text-2xl font-black text-foreground">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Done
              </p>
              <p className="text-2xl font-black text-foreground">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Paid
              </p>
              <p className="text-2xl font-black text-emerald-600">{stats.paid}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
