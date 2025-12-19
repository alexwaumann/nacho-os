import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, AlertCircle, Clock } from "lucide-react";

interface JobCardProps {
  address: string;
  createdDate: string;
  dueDate: string;
  status: string;
  description: string;
  progress: {
    current: number;
    total: number;
  };
  onClick?: () => void;
}

export default function JobCard({
  address,
  createdDate,
  dueDate,
  status,
  description,
  progress,
  onClick,
}: JobCardProps) {
  const progressValue = (progress.current / progress.total) * 100;

  return (
    <Card 
      className="border border-border shadow-sm bg-card overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-4">
        <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
          {address}
        </h3>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-bold border border-primary/20">
            <Calendar size={12} />
            Created: {createdDate}
          </div>
          
          <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg shadow-none uppercase">
            <AlertCircle size={12} />
            {status}
          </Badge>

          <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg text-xs font-bold border border-border w-full sm:w-auto">
            <Clock size={12} />
            Due: {dueDate}
          </div>
        </div>

        <p className="text-muted-foreground text-sm font-medium line-clamp-2">
          {description}
        </p>

        <div className="space-y-2">
          <div className="flex justify-end">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {progress.current}/{progress.total}
            </span>
          </div>
          <Progress value={progressValue} className="h-2 bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
