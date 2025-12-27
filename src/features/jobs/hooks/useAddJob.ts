import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import { processFileToImages } from "@/lib/pdf";

type ProcessedFile = {
  file: File;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
};

export function useAddJob() {
  const [files, setFiles] = useState<Array<ProcessedFile>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const enqueueJob = useMutation(api.jobs.enqueueJob);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const addFiles = (newFiles: Array<File>) => {
    const processedFiles: Array<ProcessedFile> = newFiles.map((file) => ({
      file,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...processedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearState = () => {
    setFiles([]);
    setIsProcessing(false);
    setIsDone(false);
    setProcessedCount(0);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessedCount(0);

    try {
      const processSingleFile = async (file: File, index: number) => {
        // Update status to processing
        setFiles((prev) =>
          prev.map((f, idx) => (idx === index ? { ...f, status: "processing" as const } : f)),
        );

        try {
          // Step 1: Convert file to images (PDF pages or compressed image)
          const images = await processFileToImages(file);

          // Step 2: Upload images to Convex storage in parallel
          const uploadPromises = images.map(async (image) => {
            // Get upload URL
            const uploadUrl = await generateUploadUrl();

            // Convert base64 to blob
            const binaryStr = atob(image.base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) {
              bytes[j] = binaryStr.charCodeAt(j);
            }
            const blob = new Blob([bytes], { type: image.mimeType });

            // Upload to Convex
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": image.mimeType },
              body: blob,
            });

            if (!response.ok) {
              throw new Error("Failed to upload image");
            }

            const { storageId } = await response.json();
            return storageId as Id<"_storage">;
          });

          const storageIds = await Promise.all(uploadPromises);

          // Step 3: Enqueue job in Convex for background processing
          await enqueueJob({
            fileStorageIds: storageIds,
            fileName: file.name,
          });

          // Update status to done
          setFiles((prev) =>
            prev.map((f, idx) => (idx === index ? { ...f, status: "done" as const } : f)),
          );
          setProcessedCount((prev) => prev + 1);
          return true;
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to process ${file.name}: ${errorMessage}`);
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === index ?
                {
                  ...f,
                  status: "error" as const,
                  error: errorMessage,
                }
              : f,
            ),
          );
          return false;
        }
      };

      const results = await Promise.all(files.map((f, i) => processSingleFile(f.file, i)));
      const successCount = results.filter(Boolean).length;

      if (successCount > 0) {
        toast.success(`Queued ${successCount} job(s) for background processing`);
      }
      setIsDone(true);
    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    files: files.map((f) => f.file),
    fileStatuses: files,
    addFiles,
    removeFile,
    clearState,
    isProcessing,
    isDone,
    processedCount,
    handleProcess,
  };
}
