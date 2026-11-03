import type { Id } from "../_generated/dataModel";

// A job's source document. The website renders a PDF's pages to images and sends them as the
// page images, plus the original as `sourceFileId` (only used for extraction, then deleted).
// The iOS app sends a PDF as-is: just `sourceFileId`, no page images, so the PDF is kept on the
// job as its document.

/**
 * The original upload to keep on the new job: kept only when there are no page images to show
 * instead (a PDF sent by the iOS app). Otherwise it's deleted after extraction, as before.
 */
export function getKeptSourceFileId(
  sourceFileId: Id<"_storage"> | undefined,
  pageImageIds: ReadonlyArray<Id<"_storage">>,
): Id<"_storage"> | undefined {
  return pageImageIds.length === 0 ? sourceFileId : undefined;
}

export const SOURCE_FILE_TOO_LARGE =
  "This file is too large to read (over 15 MB). Try a smaller PDF or photos of the pages.";
