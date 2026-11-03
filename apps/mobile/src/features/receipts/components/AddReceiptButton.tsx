import type { Id } from "@convex/_generated/dataModel";
import { ActionButton } from "@/features/job-detail/components/SheetParts";

import { useAddReceipt } from "../hooks/useAddReceipt";

/** "Add receipt" on a job's Money tab: scan, photograph or pick a receipt for this job */
export function AddReceiptButton({ jobId }: { jobId: Id<"jobs"> }) {
  const { addReceipt, isAdding } = useAddReceipt(jobId);
  return (
    <ActionButton
      title={isAdding ? "Adding receipt…" : "Add receipt"}
      icon="plus"
      variant="outline"
      isLoading={isAdding}
      onPress={() => void addReceipt()}
    />
  );
}
