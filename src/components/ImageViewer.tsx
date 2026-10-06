import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/lib/utils";

// Radix (not base-ui) so the viewer nests properly inside vaul drawers, which are Radix dialogs:
// the drawer's focus trap, outside-click dismissal and Escape handling all defer to the viewer.

export interface ImageViewerImage {
  src: string;
  /** Shown in the top bar and used as the image's alt text */
  caption?: string;
}

interface ImageViewerProps {
  images: Array<ImageViewerImage>;
  /** Image to show first each time the viewer opens */
  startIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewer({ images, startIndex = 0, open, onOpenChange }: ImageViewerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] bg-black text-white outline-none select-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150"
          // Keep gestures from reaching a parent drawer through the React tree, which would drag it
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onPointerCancel={(e) => e.stopPropagation()}
        >
          <DialogPrimitive.Title className="sr-only">Image viewer</DialogPrimitive.Title>
          {images.length > 0 && (
            <ImageViewerBody
              images={images}
              startIndex={Math.min(startIndex, images.length - 1)}
              onClose={() => onOpenChange(false)}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const BUTTON_ZOOM_STEP = 1.5;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_THRESHOLD = 60;
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 300;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

interface ImageViewerBodyProps {
  images: Array<ImageViewerImage>;
  startIndex: number;
  onClose: () => void;
}

function ImageViewerBody({ images, startIndex, onClose }: ImageViewerBodyProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [index, setIndex] = useState(startIndex);
  const [transform, setTransformState] = useState<Transform>(IDENTITY);
  // Animate programmatic zooms (buttons, double tap, snap back) but not live finger tracking
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Active pointers, and the transform + pointer positions when the current gesture began
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ transform: Transform; pointers: Array<Point> } | null>(null);
  const swipeRef = useRef<{ dx: number; dy: number; isTap: boolean } | null>(null);
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null);
  // Mirrors `transform` synchronously so back-to-back events (wheel, pointer moves) build on
  // the latest value rather than the last rendered one
  const transformRef = useRef<Transform>(IDENTITY);

  const setTransform = (next: Transform) => {
    transformRef.current = next;
    setTransformState(next);
  };

  const count = images.length;
  const hasMultiple = count > 1;
  const image = images[index];
  const isZoomed = transform.scale > 1.01;

  /** Pointer position relative to the stage's center, which is the transform origin */
  const toStagePoint = (clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  /** Keep the scale in range and stop the image from being panned off-screen */
  const constrain = (next: Transform): Transform => {
    const stage = stageRef.current;
    const img = imageRef.current;
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (!stage || !img) return { scale, x: 0, y: 0 };
    const maxX = Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2);
    return { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  };

  /** Zoom to `scale`, keeping the image point under `anchor` fixed on screen */
  const zoomAt = (scale: number, anchor: Point, from: Transform = transformRef.current) => {
    const nextScale = clamp(scale, MIN_SCALE, MAX_SCALE);
    const ratio = nextScale / from.scale;
    return constrain({
      scale: nextScale,
      x: anchor.x - (anchor.x - from.x) * ratio,
      y: anchor.y - (anchor.y - from.y) * ratio,
    });
  };

  const animateTo = (next: Transform) => {
    setIsAnimating(true);
    setTransform(next);
  };

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= count || nextIndex === index) return;
    setIndex(nextIndex);
    setIsLoaded(false);
    setIsAnimating(false);
    setTransform(IDENTITY);
  };

  const handlePrev = () => goTo(index - 1);
  const handleNext = () => goTo(index + 1);
  const handleZoomIn = () => animateTo(zoomAt(transform.scale * BUTTON_ZOOM_STEP, { x: 0, y: 0 }));
  const handleZoomOut = () => animateTo(zoomAt(transform.scale / BUTTON_ZOOM_STEP, { x: 0, y: 0 }));
  const handleResetZoom = () => animateTo(IDENTITY);

  // Re-baseline the gesture whenever a finger is added or lifted so the transform doesn't jump
  const startGesture = () => {
    gestureRef.current = {
      transform: transformRef.current,
      pointers: [...pointersRef.current.values()],
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, toStagePoint(e.clientX, e.clientY));
    swipeRef.current = pointersRef.current.size === 1 ? { dx: 0, dy: 0, isTap: true } : null;
    setIsAnimating(false);
    setIsDragging(true);
    startGesture();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId) || !gestureRef.current) return;
    pointersRef.current.set(e.pointerId, toStagePoint(e.clientX, e.clientY));

    const start = gestureRef.current;
    const current = [...pointersRef.current.values()];

    if (current.length >= 2 && start.pointers.length >= 2) {
      // Pinch: scale by finger spread, anchored where the fingers started, and follow their midpoint
      const startMid = midpoint(start.pointers[0], start.pointers[1]);
      const mid = midpoint(current[0], current[1]);
      const spread =
        distance(current[0], current[1]) / distance(start.pointers[0], start.pointers[1]);
      const zoomed = zoomAt(start.transform.scale * spread, startMid, start.transform);
      setTransform(
        constrain({
          ...zoomed,
          x: zoomed.x + mid.x - startMid.x,
          y: zoomed.y + mid.y - startMid.y,
        }),
      );
      return;
    }

    const dx = current[0].x - start.pointers[0].x;
    const dy = current[0].y - start.pointers[0].y;
    if (swipeRef.current) {
      swipeRef.current = {
        dx,
        dy,
        isTap: swipeRef.current.isTap && Math.hypot(dx, dy) < TAP_SLOP,
      };
    }

    if (start.transform.scale > 1.01) {
      setTransform(
        constrain({ ...start.transform, x: start.transform.x + dx, y: start.transform.y + dy }),
      );
    } else if (hasMultiple) {
      // Not zoomed: the image follows a horizontal swipe to hint at prev/next
      setTransform({ scale: 1, x: dx, y: 0 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const point = pointersRef.current.get(e.pointerId)!;
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size > 0) {
      startGesture();
      return;
    }

    setIsDragging(false);
    gestureRef.current = null;
    const swipe = swipeRef.current;
    swipeRef.current = null;
    const wasZoomed = transformRef.current.scale > 1.01;

    if (swipe?.isTap && e.type === "pointerup") {
      const lastTap = lastTapRef.current;
      const now = performance.now();
      if (lastTap && now - lastTap.time < DOUBLE_TAP_MS && distance(lastTap.point, point) < 40) {
        lastTapRef.current = null;
        animateTo(wasZoomed ? IDENTITY : zoomAt(DOUBLE_TAP_SCALE, point));
        return;
      }
      lastTapRef.current = { time: now, point };
    }

    if (!wasZoomed) {
      if (
        swipe &&
        Math.abs(swipe.dx) > SWIPE_THRESHOLD &&
        Math.abs(swipe.dx) > Math.abs(swipe.dy)
      ) {
        const target = swipe.dx < 0 ? index + 1 : index - 1;
        if (target >= 0 && target < count) {
          goTo(target);
          return;
        }
      }
      // Snap back from a partial swipe
      if (transformRef.current.x !== 0) animateTo(IDENTITY);
    }
  };

  // Mouse wheel / trackpad pinch zoom. Attached natively because React's wheel listener is
  // passive and can't stop the page from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpad pinches arrive as ctrl+wheel with small deltas
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      setIsAnimating(false);
      setTransform(zoomAt(transformRef.current.scale * factor, toStagePoint(e.clientX, e.clientY)));
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "+" || e.key === "=") handleZoomIn();
      else if (e.key === "-") handleZoomOut();
      else if (e.key === "0") handleResetZoom();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Keep the image in bounds when the screen rotates or the window resizes
  useEffect(() => {
    const handleResize = () => setTransform(constrain(transformRef.current));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  return (
    <div className="absolute inset-0">
      {/* Stage: all gestures happen here */}
      <div
        ref={stageRef}
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden touch-none",
          isZoomed && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          key={image.src}
          ref={imageRef}
          src={image.src}
          alt={image.caption ?? `Image ${index + 1} of ${count}`}
          draggable={false}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "max-w-full max-h-full object-contain will-change-transform",
            isAnimating && "transition-transform duration-200 ease-out",
            !isLoaded && "opacity-0",
          )}
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
          onTransitionEnd={() => setIsAnimating(false)}
        />
        {!isLoaded && (
          <Loader2 className="absolute w-10 h-10 animate-spin text-white/70" aria-hidden />
        )}
      </div>

      {/* Top bar: count, caption, close */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        {(hasMultiple || image.caption) && (
          <div className="min-w-0 rounded-2xl bg-black/60 backdrop-blur-md px-4 py-2">
            {hasMultiple && (
              <div className="text-lg font-black tabular-nums" aria-live="polite">
                {index + 1} / {count}
              </div>
            )}
            {image.caption && (
              <div className="text-base font-semibold text-white/90 truncate">{image.caption}</div>
            )}
          </div>
        )}
        <ViewerButton label="Close" onClick={onClose} className="ml-auto pointer-events-auto">
          <X className="w-7 h-7" />
        </ViewerButton>
      </div>

      {/* Prev / next */}
      {hasMultiple && (
        <>
          <ViewerButton
            label="Previous image"
            onClick={handlePrev}
            disabled={index === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2"
          >
            <ChevronLeft className="w-8 h-8" />
          </ViewerButton>
          <ViewerButton
            label="Next image"
            onClick={handleNext}
            disabled={index === count - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <ChevronRight className="w-8 h-8" />
          </ViewerButton>
        </>
      )}

      {/* Bottom bar: zoom controls */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md p-1.5 pointer-events-auto">
          <ViewerButton
            label="Zoom out"
            onClick={handleZoomOut}
            disabled={transform.scale <= MIN_SCALE}
            className="bg-transparent"
          >
            <ZoomOut className="w-7 h-7" />
          </ViewerButton>
          <button
            type="button"
            onClick={handleResetZoom}
            aria-label="Reset zoom"
            className="min-w-16 h-12 px-2 rounded-full text-base font-black tabular-nums hover:bg-white/10 active:bg-white/20"
          >
            {Math.round(transform.scale * 100)}%
          </button>
          <ViewerButton
            label="Zoom in"
            onClick={handleZoomIn}
            disabled={transform.scale >= MAX_SCALE}
            className="bg-transparent"
          >
            <ZoomIn className="w-7 h-7" />
          </ViewerButton>
        </div>
      </div>
    </div>
  );
}

interface ViewerButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function ViewerButton({ label, onClick, disabled, className, children }: ViewerButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity hover:bg-white/20 active:bg-white/30 disabled:opacity-30 disabled:pointer-events-none",
        className,
      )}
    >
      {children}
    </button>
  );
}
