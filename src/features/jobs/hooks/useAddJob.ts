import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import { processFileToImages } from "@/lib/pdf";
import { processJobFiles } from "@/server/jobs";

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

  const createJob = useMutation(api.jobs.create);
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
      // Process each file sequentially
      for (let i = 0; i < files.length; i++) {
        const { file } = files[i];

        // Update status to processing
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "processing" as const } : f)),
        );

        try {
          // Step 1: Convert file to images (PDF pages or compressed image)
          const images = await processFileToImages(file);

          // Step 2: Process with server function (Gemini + geocoding)
          const processedJob = await processJobFiles({
            data: { images },
          });

          console.log(processedJob);

          // Step 3: Upload images to Convex storage
          const storageIds: Array<Id<"_storage">> = [];

          for (const image of images) {
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
            storageIds.push(storageId as Id<"_storage">);
          }

          // Step 4: Create job in Convex
          const tasks = processedJob.tasks.map((task, idx) => ({
            id: `task-${idx}-${Date.now()}`,
            text: `${task.category ? `[${task.category}] ` : ""}${task.taskName} ${task.specificInstructions ? `: ${task.specificInstructions}` : ""} ${task.quantity && task.unit ? ` (${task.quantity} ${task.unit})` : ""}`,
            requiresOnlineOrder: task.requiresOnlineOrder,
            completed: false,
          }));

          await createJob({
            address: processedJob.propertyAddress,
            summary: processedJob.jobSummary,
            tasks,
            tools: processedJob.toolsNeeded,
            materials: processedJob.materialsNeeded,
            accessCodes: processedJob.accessCodes,
            dueDate: processedJob.targetCompletionDate,
            coordinates: processedJob.coordinates ?? undefined,
            sourceImageIds: storageIds,
          });

          // Update status to done
          setFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: "done" as const } : f)),
          );
          setProcessedCount((prev) => prev + 1);
          toast.success(`Job added: ${processedJob.propertyAddress}`);
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to process ${file.name}: ${errorMessage}`);
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ?
                {
                  ...f,
                  status: "error" as const,
                  error: errorMessage,
                }
              : f,
            ),
          );
        }
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
