import { CalendarPlus, CircleCheckBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AllStopsDoneCardProps {
  onPlanTomorrow: () => void;
}

/** Shown above the route once every stop on it is done. */
export function AllStopsDoneCard({ onPlanTomorrow }: AllStopsDoneCardProps) {
  return (
    <Card className="border-2 border-emerald-500/40 bg-emerald-50 py-0 shadow-sm dark:bg-emerald-950/30">
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-3 text-xl font-black text-foreground">
          <CircleCheckBig size={28} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          All stops done for today
        </p>
        <Button onClick={onPlanTomorrow} className="h-12 w-full gap-2 rounded-xl text-lg font-bold">
          <CalendarPlus className="size-6" />
          Plan tomorrow
        </Button>
      </CardContent>
    </Card>
  );
}
