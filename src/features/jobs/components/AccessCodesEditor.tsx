import { Key, Plus } from "lucide-react";
import { useState } from "react";

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

  const handleAdd = () => {
    const code = newCode.trim();
    if (!code) return;
    onChange([...codes, code]);
    setNewCode("");
  };

  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
        <Key className="w-3.5 h-3.5" />
        Access Codes
      </h4>
      <div className="flex flex-wrap gap-2">
        {codes.map((code, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="font-mono text-sm px-3 py-1.5 bg-muted/50 rounded-xl"
          >
            {code}
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
