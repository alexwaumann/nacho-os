import { useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@shared/errors";

import type { CapturedImage } from "../lib/capture";
import { readImageData } from "../lib/imageData";
import type { ImageData } from "../lib/imageData";

export type ReadState<T> =
  | { status: "reading" }
  | { status: "error"; message: string }
  | { status: "done"; result: T };

/**
 * Read `image` with `read` (a Gemini action) as soon as it's set, and again on `retry()` or when
 * the photo changes. Each attempt runs once, even when effects run twice in development, because
 * every read costs a Gemini call.
 */
export function useReadImage<T>(
  image: CapturedImage | null,
  read: (data: ImageData) => Promise<T>,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReadState<T>>({ status: "reading" });
  const startedKey = useRef<string | null>(null);
  const readRef = useRef(read);

  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    if (!image) return;
    const key = `${image.uri}#${attempt}`;
    if (startedKey.current === key) return;
    startedKey.current = key;

    setState({ status: "reading" });
    readImageData(image)
      .then((data) => readRef.current(data))
      .then(
        (result) => {
          if (startedKey.current === key) setState({ status: "done", result });
        },
        (error: unknown) => {
          console.log("Couldn't read the photo:", error);
          if (startedKey.current !== key) return;
          setState({
            status: "error",
            message: getErrorMessage(error, "Something went wrong. Please try again."),
          });
        },
      );
  }, [image, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
