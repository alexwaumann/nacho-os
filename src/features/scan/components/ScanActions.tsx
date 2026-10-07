import { Banknote, Loader2, Plus, Receipt } from "lucide-react";
import { useRef } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { LucideIcon } from "lucide-react";
import { CheckDetectedModal } from "@/features/checks/components/CheckDetectedModal";
import { useAddCheck } from "@/features/checks/hooks/useAddCheck";
import { AddJobModal } from "@/features/jobs/components/AddJobModal";
import { ReceiptDetectedModal } from "@/features/receipts/components/ReceiptDetectedModal";
import { useScanReceipt } from "@/features/receipts/hooks/useScanReceipt";
import { cn } from "@/lib/utils";

const ACCEPTED_FILES = "image/*,application/pdf";

interface ScanActionsProps {
  className?: string;
}

/**
 * The three big action buttons on the home page. "Add Job" opens the multi-file add-jobs
 * modal (work orders are almost always PDFs, often several at once). Receipts and checks
 * start from taking or picking a photo. Owns the file pickers, the reading (Gemini) hooks
 * and the "found" modals, so the page only has to render <ScanActions />.
 * Must be rendered on the "/" route: the add-job flow uses its `new-job` search param.
 */
export function ScanActions({ className }: ScanActionsProps) {
  // 1. Hooks
  const navigate = useNavigate({ from: "/" });
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const checkInputRef = useRef<HTMLInputElement>(null);

  const receipt = useScanReceipt();
  const check = useAddCheck();

  // 2. Handlers
  const handleAddJobClick = () => {
    navigate({ search: (prev) => ({ ...prev, "new-job": "true" }) });
  };

  const handleFileChange =
    (onFiles: (files: Array<File>) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // Reset so the same file can be picked again
      e.target.value = "";
      if (files.length > 0) onFiles(files);
    };

  // 3. Render
  return (
    <>
      <div className={cn("grid grid-cols-3 gap-3", className)}>
        <ScanButton
          icon={Plus}
          label="Add Job"
          iconClassName="bg-primary/10 text-primary"
          onClick={handleAddJobClick}
        />
        <ScanButton
          icon={Receipt}
          label="Scan receipt"
          iconClassName="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100"
          isBusy={receipt.isProcessing}
          onClick={() => receiptInputRef.current?.click()}
        />
        <ScanButton
          icon={Banknote}
          label="Scan check"
          iconClassName="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100"
          isBusy={check.isProcessing}
          onClick={() => checkInputRef.current?.click()}
        />
      </div>

      {/* Hidden file pickers. No `capture`, so photos and PDFs already on the phone work too. */}
      <input
        ref={receiptInputRef}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        onChange={handleFileChange(([file]) => void receipt.handleFileSelect(file))}
      />
      <input
        ref={checkInputRef}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        onChange={handleFileChange(([file]) => void check.handleFileSelect(file))}
      />

      <AddJobModal />

      {receipt.receiptData && receipt.imageData && (
        <ReceiptDetectedModal
          open
          onOpenChange={(open) => !open && receipt.reset()}
          receiptData={receipt.receiptData}
          imageData={receipt.imageData}
          onCancel={receipt.reset}
        />
      )}

      {check.checkData && check.imageData && (
        <CheckDetectedModal
          open
          onOpenChange={(open) => !open && check.reset()}
          checkData={check.checkData}
          imageData={check.imageData}
          onCancel={check.reset}
        />
      )}
    </>
  );
}

interface ScanButtonProps {
  icon: LucideIcon;
  label: string;
  iconClassName: string;
  isBusy?: boolean;
  onClick: () => void;
}

function ScanButton({
  icon: Icon,
  label,
  iconClassName,
  isBusy = false,
  onClick,
}: ScanButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      aria-busy={isBusy}
      className={cn(
        "min-h-32 rounded-2xl border border-border bg-card px-2 py-4 shadow-sm",
        "flex flex-col items-center justify-center gap-3 text-center transition-transform",
        isBusy ? "opacity-80" : "active:scale-95",
      )}
    >
      <span className={cn("size-14 rounded-2xl flex items-center justify-center", iconClassName)}>
        {isBusy ?
          <Loader2 size={32} className="animate-spin" />
        : <Icon size={32} strokeWidth={2.25} />}
      </span>
      <span className="text-base font-bold leading-tight text-foreground">
        {isBusy ? "Reading..." : label}
      </span>
    </button>
  );
}
