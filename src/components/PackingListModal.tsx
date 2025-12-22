import { useQuery } from "convex/react";
import { CheckCircle2, Package, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "../../convex/_generated/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface PackingListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChecklistItem = {
  id: string;
  name: string;
  checked: boolean;
};

export function PackingListModal({ open, onOpenChange }: PackingListModalProps) {
  const selectedJobs = useQuery(api.jobs.getSelectedForRoute) ?? [];

  // Local state for checked items (not persisted)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Aggregate materials and tools from selected jobs
  const { materials, tools } = useMemo(() => {
    const materialSet = new Map<string, number>();
    const toolSet = new Set<string>();

    for (const job of selectedJobs) {
      for (const task of job.tasks ?? []) {
        if (!task.completed) {
          for (const material of task.materials ?? []) {
            materialSet.set(material, (materialSet.get(material) ?? 0) + 1);
          }
          for (const tool of task.tools ?? []) {
            toolSet.add(tool);
          }
        }
      }
    }

    const materialsList: Array<ChecklistItem> = Array.from(materialSet.entries()).map(
      ([name, count]) => ({
        id: `material-${name}`,
        name: count > 1 ? `${name} (x${count})` : name,
        checked: checkedItems.has(`material-${name}`),
      }),
    );

    const toolsList: Array<ChecklistItem> = Array.from(toolSet).map((name) => ({
      id: `tool-${name}`,
      name,
      checked: checkedItems.has(`tool-${name}`),
    }));

    return { materials: materialsList, tools: toolsList };
  }, [selectedJobs, checkedItems]);

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const materialProgress =
    materials.length > 0 ? (materials.filter((m) => m.checked).length / materials.length) * 100 : 0;

  const toolProgress =
    tools.length > 0 ? (tools.filter((t) => t.checked).length / tools.length) * 100 : 0;

  const clearAll = () => setCheckedItems(new Set());

  const checkAll = () => {
    const allIds = [...materials.map((m) => m.id), ...tools.map((t) => t.id)];
    setCheckedItems(new Set(allIds));
  };

  if (selectedJobs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Packing List</DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center">
            <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">
              Select jobs for your route to generate a packing list.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-black">Packing List</DialogTitle>
            <Badge variant="secondary" className="font-bold">
              {selectedJobs.length} job{selectedJobs.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Progress Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  Materials
                </span>
                <span className="font-bold text-muted-foreground">
                  {Math.round(materialProgress)}%
                </span>
              </div>
              <Progress value={materialProgress} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  Tools
                </span>
                <span className="font-bold text-muted-foreground">{Math.round(toolProgress)}%</span>
              </div>
              <Progress value={toolProgress} className="h-2" />
            </div>
          </div>

          <Separator />

          {/* Checklist */}
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-6 pr-4">
              {/* Materials Section */}
              {materials.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Materials ({materials.filter((m) => m.checked).length}/{materials.length})
                  </h4>
                  <div className="space-y-2">
                    {materials.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          item.checked ?
                            "bg-muted/50 border-border"
                          : "bg-card border-border hover:border-primary/30"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            item.checked ?
                              "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                          }`}
                        >
                          {item.checked && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span
                          className={`text-sm font-medium flex-1 ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {item.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools Section */}
              {tools.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    Tools ({tools.filter((t) => t.checked).length}/{tools.length})
                  </h4>
                  <div className="space-y-2">
                    {tools.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          item.checked ?
                            "bg-muted/50 border-border"
                          : "bg-card border-border hover:border-primary/30"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            item.checked ?
                              "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                          }`}
                        >
                          {item.checked && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span
                          className={`text-sm font-medium flex-1 ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {item.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={clearAll} className="flex-1">
            Clear All
          </Button>
          <Button onClick={checkAll} className="flex-1">
            Check All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
