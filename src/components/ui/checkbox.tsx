import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onCheckedChange, className, disabled }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "h-8 w-8 shrink-0 rounded-lg border-2 transition-all flex items-center justify-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ?
          "bg-primary border-primary text-primary-foreground"
        : "border-muted-foreground/30 bg-background hover:border-primary/50",
        className,
      )}
    >
      {checked && <Check className="h-5 w-5" strokeWidth={3} />}
    </button>
  );
}
