import { Check, Clock, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDueDate } from "@/lib/utils";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DueDateEditorProps {
  dueDate: string | undefined;
  onChange: (dueDate: string | null) => void;
}

// A read-only due date tag that turns into a date input when tapped
export function DueDateEditor({ dueDate, onChange }: DueDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return dueDate ?
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
        </Badge>;
  }

  return (
    <DueDateInput
      dueDate={dueDate}
      onChange={onChange}
      onClear={() => {
        onChange(null);
        setIsEditing(false);
      }}
      onDone={() => setIsEditing(false)}
    />
  );
}

interface DueDateInputProps {
  dueDate: string | undefined;
  onChange: (dueDate: string | null) => void;
  onClear: () => void;
  onDone: () => void;
}

function DueDateInput({ dueDate, onChange, onClear, onDone }: DueDateInputProps) {
  // Date inputs only accept YYYY-MM-DD; older free-text dates start out empty
  const savedValue = dueDate && ISO_DATE.test(dueDate) ? dueDate : "";
  const [draft, setDraft] = useState(savedValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(savedValue);
  }, [savedValue]);

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
    <div className="basis-full flex gap-2">
      <Input
        ref={inputRef}
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
          onClick={onClear}
          aria-label="Clear due date"
          className="shrink-0 h-12 w-12 rounded-2xl"
        >
          <X className="h-5 w-5" />
        </Button>
      )}
      <Button
        size="icon"
        onClick={onDone}
        aria-label="Done editing due date"
        className="shrink-0 h-12 w-12 rounded-2xl"
      >
        <Check className="h-5 w-5" />
      </Button>
    </div>
  );
}
