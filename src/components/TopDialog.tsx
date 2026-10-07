import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TopDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * A small dialog pinned to the top of the screen, for any text field that would otherwise sit
 * inside the job sheet. iOS pans the page to reach a focused field that ends up under the
 * keyboard, which drags the sheet out of view. Up here the field is always above the keyboard,
 * so nothing moves. Radix (not base-ui) so it nests in the vaul drawer like the image viewer.
 *
 * Children are only mounted while open, so a form can start its draft from fresh props.
 */
export function TopDialog({ open, onClose, children, className }: TopDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Radix would focus the Close button (the first tabbable); the field is what he wants
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector<HTMLElement>("input, textarea")?.focus();
          }}
          className={cn(
            "fixed inset-x-0 top-0 z-[60] mx-auto max-w-lg px-3 pt-[max(0.75rem,env(safe-area-inset-top))] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-top-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150",
            className,
          )}
          // Keep gestures from reaching the drawer through the React tree, which would drag it
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {open && children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface TopDialogHeaderProps {
  title: string;
  /** Something to show before the title, like a photo thumbnail */
  leading?: ReactNode;
}

export function TopDialogHeader({ title, leading }: TopDialogHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      {leading}
      <DialogPrimitive.Title className="flex-1 text-xl font-black leading-tight">
        {title}
      </DialogPrimitive.Title>
      <DialogPrimitive.Close
        aria-label="Close"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <X className="size-5" />
      </DialogPrimitive.Close>
    </div>
  );
}

/** The card itself, as a form so Enter and the Save button both submit */
export function TopDialogForm({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      className={cn(
        "rounded-[1.5rem] bg-background border border-border shadow-2xl p-4 space-y-4",
        className,
      )}
      {...props}
    />
  );
}
