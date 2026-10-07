import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";

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

// Pinned to the top of the screen, not inside the job sheet: iOS pans the page to reach a
// focused field that sits under the keyboard, which drags the sheet out of view. Up here the
// field is always visible, so nothing moves. Radix (not base-ui) so it nests in the vaul drawer
// like the image viewer does.
export function PhotoCaptionDialog({
  open,
  imageUrl,
  caption,
  onSave,
  onClose,
}: PhotoCaptionDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-[60] mx-auto max-w-lg px-3 pt-[max(0.75rem,env(safe-area-inset-top))] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-top-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150"
          // Keep gestures from reaching the drawer through the React tree, which would drag it
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {open && (
            <CaptionForm imageUrl={imageUrl} caption={caption} onSave={onSave} onClose={onClose} />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
    <form
      className="rounded-[1.5rem] bg-background border border-border shadow-2xl p-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="flex items-center gap-3">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover border border-border"
          />
        )}
        <DialogPrimitive.Title className="flex-1 text-xl font-black leading-tight">
          {caption ? "Change caption" : "Add a caption"}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </div>
      <Input
        autoFocus
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
    </form>
  );
}
