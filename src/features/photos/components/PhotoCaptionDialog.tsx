import { useState } from "react";

import { TopDialog, TopDialogForm, TopDialogHeader } from "@/components/TopDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PhotoCaptionDialogProps {
  open: boolean;
  /** The photo being captioned: its thumbnail and current caption */
  imageUrl: string | null;
  caption: string;
  onSave: (caption: string) => void;
  onClose: () => void;
}

export function PhotoCaptionDialog({
  open,
  imageUrl,
  caption,
  onSave,
  onClose,
}: PhotoCaptionDialogProps) {
  return (
    <TopDialog open={open} onClose={onClose}>
      <CaptionForm imageUrl={imageUrl} caption={caption} onSave={onSave} onClose={onClose} />
    </TopDialog>
  );
}

// Mounted fresh each time the dialog opens, so the draft starts from that photo's caption
function CaptionForm({
  imageUrl,
  caption,
  onSave,
  onClose,
}: Omit<PhotoCaptionDialogProps, "open">) {
  const [draft, setDraft] = useState(caption);

  return (
    <TopDialogForm
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <TopDialogHeader
        title={caption ? "Change caption" : "Add a caption"}
        leading={
          imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover border border-border"
            />
          )
        }
      />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Like Bathroom 2 or Kitchen before"
        aria-label="Photo caption"
        enterKeyHint="done"
        autoCapitalize="sentences"
        className="h-14 rounded-2xl px-4 text-lg md:text-lg"
      />
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-14 text-lg font-bold rounded-2xl"
          onClick={onClose}
        >
          {caption ? "Cancel" : "Skip"}
        </Button>
        <Button type="submit" className="flex-1 h-14 text-lg font-black rounded-2xl">
          Save
        </Button>
      </div>
    </TopDialogForm>
  );
}
