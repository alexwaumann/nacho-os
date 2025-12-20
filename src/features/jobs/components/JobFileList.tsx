import { FileText, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface JobFileListProps {
  files: File[];
  onRemove: (index: number) => void;
  isProcessing: boolean;
  isDone: boolean;
}

export function JobFileList({ files, onRemove, isProcessing, isDone }: JobFileListProps) {
  if (files.length === 0) {
    return (
      <div className="border border-border rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground bg-card/50">
        <FileText size={48} strokeWidth={1} className="opacity-20" />
        <p className="font-medium text-sm text-center">No files selected</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[280px] w-full rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="p-4 space-y-3 overflow-x-hidden">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center p-4 rounded-xl bg-background border border-border shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
              <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                <FileText size={18} className="text-muted-foreground" />
              </div>
              <span className="text-sm font-medium truncate text-foreground">{file.name}</span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {isProcessing ?
                <Loader2 size={18} className="text-primary animate-spin" />
              : isDone ?
                <CheckCircle2 size={18} className="text-emerald-500" />
              : <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 size={16} />
                </Button>
              }
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
