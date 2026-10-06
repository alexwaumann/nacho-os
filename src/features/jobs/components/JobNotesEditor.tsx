import { useEffect, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

interface JobNotesEditorProps {
  notes: string;
  onSave: (notes: string) => void;
}

// Owns the draft text so typing only re-renders this section, not the whole job sheet
export function JobNotesEditor({ notes, onSave }: JobNotesEditorProps) {
  const [draft, setDraft] = useState(notes);

  // Pick up changes saved elsewhere (another device, or a rollback after a failed save)
  useEffect(() => {
    setDraft(notes);
  }, [notes]);

  const handleBlur = () => {
    if (draft !== notes) onSave(draft);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
        Job Notes
      </h4>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add private notes about this job..."
        className="min-h-[140px] rounded-[1.5rem] p-4 resize-none bg-muted/20 border-border/50 focus:bg-background transition-colors"
      />
    </div>
  );
}
