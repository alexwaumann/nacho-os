import { Key, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { TopDialog, TopDialogForm, TopDialogHeader } from "@/components/TopDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AccessCodesEditorProps {
  codes: Array<string>;
  onChange: (codes: Array<string>) => void;
}

// New codes are typed in a dialog pinned to the top of the screen, so the iOS keyboard can't
// push the job sheet off-screen while typing
export function AccessCodesEditor({ codes, onChange }: AccessCodesEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  // Latest codes for the undo toast, which can fire after other edits
  const codesRef = useRef(codes);
  codesRef.current = codes;

  const handleAdd = (newCode: string) => {
    const code = newCode.trim();
    if (code) onChange([...codes, code]);
    setIsAdding(false);
  };

  const handleRemove = (index: number) => {
    const removed = codes[index];
    onChange(codes.filter((_, i) => i !== index));
    toast(`Removed code ${removed}`, {
      action: {
        label: "Undo",
        onClick: () => {
          const current = codesRef.current;
          onChange([...current.slice(0, index), removed, ...current.slice(index)]);
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
        <Key className="w-3.5 h-3.5" />
        Access Codes
      </h4>
      <div className="flex flex-wrap gap-2">
        {codes.map((code, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="font-mono text-base h-auto pl-3 pr-1 py-1 gap-1 bg-muted/50 rounded-xl"
          >
            {code}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label={`Remove code ${code}`}
              className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
        ))}
        <Badge
          variant="outline"
          render={<button type="button" />}
          onClick={() => setIsAdding(true)}
          className="bg-transparent text-muted-foreground border-dashed border-border hover:text-foreground h-auto text-base font-bold px-3 py-1.5 rounded-xl cursor-pointer [&>svg]:size-4!"
        >
          <Plus className="mr-1.5" />
          Add code
        </Badge>
      </div>

      <TopDialog open={isAdding} onClose={() => setIsAdding(false)}>
        <AccessCodeForm onAdd={handleAdd} onClose={() => setIsAdding(false)} />
      </TopDialog>
    </div>
  );
}

interface AccessCodeFormProps {
  onAdd: (code: string) => void;
  onClose: () => void;
}

// Mounted fresh each time the dialog opens, so it always starts empty
function AccessCodeForm({ onAdd, onClose }: AccessCodeFormProps) {
  const [draft, setDraft] = useState("");

  return (
    <TopDialogForm
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(draft);
      }}
    >
      <TopDialogHeader title="Add access code" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Like Lockbox: 7731 or Gate 1234"
        aria-label="Access code"
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
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!draft.trim()}
          className="flex-1 h-14 text-lg font-black rounded-2xl"
        >
          Add
        </Button>
      </div>
    </TopDialogForm>
  );
}
