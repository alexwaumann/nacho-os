import { useState } from "react";
import { toast } from "sonner";

import type { ImageInput } from "@/server/gemini";
import { analyzeReceipt } from "@/server/gemini";
import { toIsoDate } from "@/lib/date";
import { processReceiptFile } from "@/lib/pdf";

const RETRY_TOAST_MS = 30_000;

const toastClassNames = {
  title: "text-base! font-bold! leading-snug!",
  description: "text-[15px]! leading-snug!",
  actionButton: "h-10! px-4! text-base! font-bold! rounded-xl!",
};

export type ProcessedReceiptData = {
  storeName: string;
  storeLocation?: string;
  summary?: string;
  total: number;
  date: string; // YYYY-MM-DD format
};

/**
 * Read a receipt photo or PDF before it is tied to a job ("scan first, pick the job second").
 */
export function useScanReceipt() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<ProcessedReceiptData | null>(null);
  const [imageData, setImageData] = useState<ImageInput | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setReceiptData(null);
    setImageData(null);

    try {
      // 1. Process file to a single image (PDF first page or compressed photo)
      const image = await processReceiptFile(file);

      // 2. Read the receipt with Gemini
      const result = await analyzeReceipt({ data: { image } });

      if (!result.total) {
        throw new Error("Could not read the total. Try a closer, flatter photo.");
      }

      setReceiptData({
        storeName: result.storeName?.trim() || "Unknown store",
        storeLocation: result.storeLocation?.trim() || undefined,
        summary: result.summary?.trim() || undefined,
        total: result.total,
        date: toIsoDate(result.date),
      });
      setImageData(image);
    } catch (error) {
      console.error("Failed to read receipt:", error);
      toast.error("Couldn't read the receipt", {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: RETRY_TOAST_MS,
        classNames: toastClassNames,
        action: { label: "Try again", onClick: () => void handleFileSelect(file) },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setReceiptData(null);
    setImageData(null);
    setIsProcessing(false);
  };

  return {
    isProcessing,
    receiptData,
    imageData,
    handleFileSelect,
    reset,
  };
}
