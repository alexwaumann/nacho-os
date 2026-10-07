import { Clock, Pencil, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TopDialog, TopDialogForm, TopDialogHeader } from "@/components/TopDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDueDate } from "@/lib/utils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DueDateEditorProps {
  dueDate: string | undefined;
  onChange: (dueDate: string | null) => void;
}

// A read-only due date tag; tapping it opens the date field in a dialog pinned to the top of
// the screen, so the picker or keyboard can't push the job sheet off-screen
export function DueDateEditor({ dueDate, onChange }: DueDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      {dueDate ?
        <Badge
          variant="outline"
          render={<button type="button" />}
          onClick={() => setIsEditing(true)}
          aria-label={`Due ${formatDueDate(dueDate)}, edit due date`}
          className="bg-orange-500/5 text-orange-600 border-orange-500/20 hover:bg-orange-500/10 h-auto text-sm font-bold px-3 py-1.5 rounded-xl cursor-pointer [&>svg]:size-4!"
        >
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          Due: {formatDueDate(dueDate)}
          <Pencil className="ml-1.5 opacity-60" />
        </Badge>
      : <Badge
          variant="outline"
          render={<button type="button" />}
          onClick={() => setIsEditing(true)}
          className="bg-transparent text-muted-foreground border-dashed border-border hover:text-foreground h-auto text-sm font-bold px-3 py-1.5 rounded-xl cursor-pointer [&>svg]:size-4!"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add due date
        </Badge>
      }

      <TopDialog open={isEditing} onClose={() => setIsEditing(false)}>
        <DueDateForm
          dueDate={dueDate}
          onSave={(value) => {
            if (value !== (dueDate ?? null)) onChange(value);
            setIsEditing(false);
          }}
          onClose={() => setIsEditing(false)}
        />
      </TopDialog>
    </>
  );
}

interface DueDateFormProps {
  dueDate: string | undefined;
  onSave: (dueDate: string | null) => void;
  onClose: () => void;
}

// Mounted fresh each time the dialog opens, so the draft starts from the saved date
function DueDateForm({ dueDate, onSave, onClose }: DueDateFormProps) {
  // Date inputs only accept YYYY-MM-DD; older free-text dates start out empty
  const savedValue = dueDate && ISO_DATE.test(dueDate) ? dueDate : "";
  const [draft, setDraft] = useState(savedValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open the native picker right away so one tap on the tag goes straight to choosing a date
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker();
    } catch {
      // Unsupported, or the browser no longer counts the tap as a user gesture
    }
  }, []);

  // Typing a year digit by digit yields dates like 0020-10-06, so wait for a 4-digit year
  const isComplete = ISO_DATE.test(draft) && Number(draft.slice(0, 4)) >= 1000;

  return (
    <TopDialogForm
      onSubmit={(e) => {
        e.preventDefault();
        // An empty field clears the due date; a half-typed one keeps whatever was saved
        if (draft === "") onSave(null);
        else if (isComplete) onSave(draft);
        else onClose();
      }}
    >
      <TopDialogHeader title={dueDate ? "Change due date" : "Add due date"} />
      <Input
        ref={inputRef}
        type="date"
        aria-label="Due date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-14 rounded-2xl px-4 text-lg md:text-lg dark:scheme-dark"
      />
      <div className="flex gap-3">
        {dueDate && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-14 text-lg font-bold rounded-2xl"
            onClick={() => onSave(null)}
          >
            Clear
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-14 text-lg font-bold rounded-2xl"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1 h-14 text-lg font-black rounded-2xl">
          Save
        </Button>
      </div>
    </TopDialogForm>
  );
}
