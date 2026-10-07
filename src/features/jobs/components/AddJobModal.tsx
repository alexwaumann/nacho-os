import { useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Play, XIcon } from "lucide-react";

import { useAddJob } from "../hooks/useAddJob";
import { JobFileList } from "./JobFileList";
import { JobFileUpload } from "./JobFileUpload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AddJobModal() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const isOpen = search["new-job"] === "true";

  const {
    files,
    addFiles,
    removeFile,
    clearState,
    isProcessing,
    isDone,
    processedCount,
    handleProcess,
  } = useAddJob();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      navigate({
        search: (prev: any) => {
          const { "new-job": _, ...rest } = prev;
          return rest;
        },
      } as any);
      // Small delay to allow closing animation before clearing state
      setTimeout(clearState, 300);
    }
  };

  const handleDone = () => {
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-[90vw] rounded-4xl p-6 gap-6 shadow-2xl"
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-2xl font-bold text-foreground">Add New Jobs</DialogTitle>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-lg" className="rounded-full bg-muted/50">
                <XIcon className="size-6" />
              </Button>
            }
          />
        </DialogHeader>

        <div className="space-y-6">
          {!isDone && <JobFileUpload onFilesSelected={addFiles} />}

          <JobFileList
            files={files}
            onRemove={removeFile}
            isProcessing={isProcessing}
            isDone={isDone}
          />

          {isDone && (
            <div className="flex flex-col items-center justify-center gap-2 py-4 animate-in zoom-in-95 duration-300">
              <p className="text-emerald-600 font-bold flex items-center gap-2 text-center">
                <CheckCircle2 size={20} className="shrink-0" />
                Submitted {processedCount} job{processedCount !== 1 ? "s" : ""}!
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Processing in background. They will appear in your inbox once finished.
              </p>
            </div>
          )}

          <div className="pt-2">
            {isDone ?
              <Button
                onClick={handleDone}
                className="w-full py-7 rounded-2xl text-lg font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Done
              </Button>
            : <Button
                disabled={files.length === 0 || isProcessing}
                onClick={handleProcess}
                className="w-full py-7 rounded-2xl text-lg font-bold shadow-lg transition-all"
              >
                {isProcessing ?
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                : <>
                    <Play className="mr-2 h-5 w-5 fill-current" />
                    Process Files
                  </>
                }
              </Button>
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
