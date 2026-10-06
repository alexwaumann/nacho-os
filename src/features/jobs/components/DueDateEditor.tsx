import { Clock, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DueDateEditorProps {
  dueDate: string | undefined;
  onChange: (dueDate: string | null) => void;
}

export function DueDateEditor({ dueDate, onChange }: DueDateEditorProps) {
  // Date inputs only accept YYYY-MM-DD; older free-text dates are shown below instead
  const savedValue = dueDate && ISO_DATE.test(dueDate) ? dueDate : "";
  const [draft, setDraft] = useState(savedValue);

  useEffect(() => {
    setDraft(savedValue);
  }, [savedValue]);

  const handleChange = (value: string) => {
    setDraft(value);
    // Typing a year digit by digit yields dates like 0020-10-06, so wait for a 4-digit year
    if (ISO_DATE.test(value) && Number(value.slice(0, 4)) >= 1000 && value !== savedValue) {
      onChange(value);
    }
  };

  // An input left empty (cleared in the picker or by keyboard) clears the due date
  const handleBlur = () => {
    if (draft === "" && savedValue !== "") onChange(null);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        Due Date
      </h4>
      <div className="flex gap-2">
        <Input
          type="date"
          aria-label="Due date"
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="h-12 rounded-2xl dark:scheme-dark"
        />
        {dueDate && (
          <Button
            size="icon"
            variant="secondary"
            onClick={() => onChange(null)}
            aria-label="Clear due date"
            className="shrink-0 h-12 w-12 rounded-2xl"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      {dueDate && !savedValue && <p className="text-xs text-muted-foreground">Due: {dueDate}</p>}
    </div>
  );
}
