import { Pencil } from "lucide-react";
import { useState } from "react";

import { TopDialog, TopDialogForm, TopDialogHeader } from "@/components/TopDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface JobNotesEditorProps {
  notes: string;
  onSave: (notes: string) => void;
}

// Shows the notes read-only; tapping them opens a dialog pinned to the top of the screen, so
// the iOS keyboard can't push the job sheet off-screen while typing
export function JobNotesEditor({ notes, onSave }: JobNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (draft: string) => {
    if (draft !== notes) onSave(draft);
    setIsEditing(false);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
        Job Notes
      </h4>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={notes ? "Edit job notes" : "Add job notes"}
        className="w-full min-h-14 flex items-start gap-3 rounded-[1.5rem] p-4 text-left bg-muted/20 border border-border/50"
      >
        {notes ?
          <span className="flex-1 min-w-0 text-base font-medium leading-relaxed whitespace-pre-wrap break-words">
            {notes}
          </span>
        : <span className="flex-1 text-base font-semibold text-muted-foreground">
            Add private notes about this job...
          </span>
        }
        <Pencil className="size-4 shrink-0 mt-1 text-muted-foreground" aria-hidden />
      </button>

      <TopDialog open={isEditing} onClose={() => setIsEditing(false)}>
        <NotesForm notes={notes} onSave={handleSave} onClose={() => setIsEditing(false)} />
      </TopDialog>
    </div>
  );
}

interface NotesFormProps {
  notes: string;
  onSave: (notes: string) => void;
  onClose: () => void;
}

// Mounted fresh each time the dialog opens, so the draft starts from the saved notes
function NotesForm({ notes, onSave, onClose }: NotesFormProps) {
  const [draft, setDraft] = useState(notes);

  return (
    <TopDialogForm
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <TopDialogHeader title={notes ? "Edit notes" : "Add notes"} />
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Private notes about this job..."
        aria-label="Job notes"
        autoCapitalize="sentences"
        className="min-h-[140px] max-h-[40vh] rounded-2xl p-4 text-lg md:text-lg"
      />
      <div className="flex gap-3">
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
