import { Key, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AccessCodesEditorProps {
  codes: Array<string>;
  onChange: (codes: Array<string>) => void;
}

// Owns the draft input state so typing only re-renders this section, not the whole job sheet
export function AccessCodesEditor({ codes, onChange }: AccessCodesEditorProps) {
  const [newCode, setNewCode] = useState("");
  // Latest codes for the undo toast, which can fire after other edits
  const codesRef = useRef(codes);
  codesRef.current = codes;

  const handleAdd = () => {
    const code = newCode.trim();
    if (!code) return;
    onChange([...codes, code]);
    setNewCode("");
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
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="New code..."
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          className="h-12 rounded-2xl"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          size="icon"
          variant="secondary"
          onClick={handleAdd}
          className="shrink-0 h-12 w-12 rounded-2xl"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
