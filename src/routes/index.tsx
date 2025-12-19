import { createFileRoute } from "@tanstack/react-router";
import { Plus, Scan, ClipboardList, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  component: YouPage,
});

function YouPage() {
  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm bg-card active:scale-95 transition-transform cursor-pointer group">
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

      {/* Packing Summary Stub */}
      <Card className="border border-border shadow-sm bg-card cursor-pointer hover:border-primary/50 transition-colors">
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Package size={16} className="text-primary" /> Packing List
            </h3>
            <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              VIEW
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                <span>Materials</span>
                <span>0%</span>
              </div>
              <Progress value={0} className="h-2 bg-muted" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                <span>Tools</span>
                <span>0%</span>
              </div>
              <Progress value={0} className="h-2 bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Plan */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-foreground">
          <ClipboardList size={24} className="text-muted-foreground" />
          <h2 className="text-xl font-bold tracking-tight">Today's Plan</h2>
        </div>

        <Card className="border-2 border-dashed border-border bg-card/50 shadow-none rounded-2xl">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
            <p className="text-muted-foreground font-medium">No stops planned.</p>
            <button className="text-primary font-bold hover:underline text-sm">
              Tap to add stops +
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
