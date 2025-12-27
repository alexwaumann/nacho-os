import * as pdfjs from "pdfjs-dist";

// Set the worker source - using the bundled worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type ImageData = {
  base64: string;
  mimeType: string;
};

/**
 * Convert a PDF file to an array of images (one per page)
 * This must run on the client as it uses canvas
 */
export async function convertPdfToImages(file: File): Promise<Array<ImageData>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pagePromises = Array.from({ length: pdf.numPages }, async (_, i) => {
    const pageNumber = i + 1;
    const page = await pdf.getPage(pageNumber);

    // Scale 2.0 provides better clarity for OCR/Vision tasks
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return null;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    // Convert to JPEG (0.8 quality for good text reading)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];

    return {
      base64,
      mimeType: "image/jpeg",
    };
  });

  const results = await Promise.all(pagePromises);
  return results.filter((img) => img !== null);
}

/**
 * Compress an image file to reduce size
 */
export function compressImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.7,
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];

        resolve({
          base64,
          mimeType: "image/jpeg",
        });
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Process a file (PDF or image) and return base64 images
 */
export async function processFileToImages(file: File): Promise<Array<ImageData>> {
  if (file.type === "application/pdf") {
    return convertPdfToImages(file);
  }

  // For images, compress and return as single-item array
  const compressed = await compressImage(file);
  return [compressed];
}
