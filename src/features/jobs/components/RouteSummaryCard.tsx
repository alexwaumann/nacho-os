interface RouteSummaryCardProps {
  totalDistance: string;
  totalDuration: string;
}

export function RouteSummaryCard({ totalDistance, totalDuration }: RouteSummaryCardProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-5 text-primary-foreground">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-2xl font-black">{totalDistance}</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Distance</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black">{totalDuration}</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">Time</p>
        </div>
      </div>
    </div>
  );
}
