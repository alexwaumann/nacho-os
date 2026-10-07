import {
  Reorder,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { Check, CircleMinus, GripVertical } from "lucide-react";
import { useRef, useState } from "react";
import { getPointerVelocity, getSwipeCommit, getSwipeReveal, isSwipeArmed } from "../lib/swipe";
import { RouteJobCard } from "./RouteJobCard";
import type { MotionValue, PanInfo } from "framer-motion";
import type { PointerSample } from "../lib/swipe";

import type { Doc } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

// A press that moves less than this (px) is a tap and opens the job
const TAP_SLOP = 5;
// Fallback width before the card has been measured
const DEFAULT_WIDTH = 400;

interface SwipeableRouteCardProps {
  job: Doc<"jobs">;
  stopNumber: number;
  isDone: boolean;
  arrivalTime?: number;
  weatherNote?: string;
  onOpen: () => void;
  /** Called when a drag on the handle ends, to save the new order */
  onReorderEnd: () => void;
  /** Called once the card has slid off after a full swipe */
  onRemove: () => void;
}

/**
 * A stop on today's route. The handle on the left drags it up or down; swiping the card left
 * or right past ~45% of its width takes it off the route.
 */
export function SwipeableRouteCard({
  job,
  stopNumber,
  isDone,
  arrivalTime,
  weatherNote,
  onOpen,
  onReorderEnd,
  onRemove,
}: SwipeableRouteCardProps) {
  const reorderControls = useDragControls();
  const swipeControls = useDragControls();
  const x = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  // Recent sideways positions with their event times, to tell a fling from a slow drag
  const samplesRef = useRef<Array<PointerSample>>([]);
  const [isArmed, setIsArmed] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const getWidth = () => cardRef.current?.offsetWidth ?? DEFAULT_WIDTH;
  // The red backdrop only shows once the card has really moved; each label fades in on its side
  const backdropOpacity = useTransform(x, [-48, -12, 12, 48], [1, 0, 0, 1]);
  const leftLabelOpacity = useTransform(x, (value) => getSwipeReveal(value, getWidth()));
  const rightLabelOpacity = useTransform(x, (value) => getSwipeReveal(-value, getWidth()));

  useMotionValueEvent(x, "change", (value) => setIsArmed(isSwipeArmed(value, getWidth())));

  const handleBodyPointerDown = (event: React.PointerEvent) => {
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    hasMovedRef.current = false;
    samplesRef.current = [{ x: event.clientX, time: event.timeStamp }];
    if (!isRemoving) swipeControls.start(event);
  };

  const handleBodyPointerMove = (event: React.PointerEvent) => {
    const start = pressStartRef.current;
    if (!start) return;
    samplesRef.current = [
      ...samplesRef.current.slice(-9),
      { x: event.clientX, time: event.timeStamp },
    ];
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= TAP_SLOP) {
      hasMovedRef.current = true;
    }
  };

  const handleBodyPointerUp = (event: React.PointerEvent) => {
    // A drag that stopped before letting go is not a fling
    samplesRef.current = [...samplesRef.current, { x: event.clientX, time: event.timeStamp }];
    pressStartRef.current = null;
  };

  const handleBodyClick = () => {
    if (hasMovedRef.current || isRemoving) return;
    onOpen();
  };

  const handleSwipeEnd = (_event: unknown, info: PanInfo) => {
    const width = getWidth();
    // The finger's distance (the card lags a frame behind); nothing if it never moved sideways
    const distance = x.get() === 0 ? 0 : info.offset.x;
    const velocity = getPointerVelocity(samplesRef.current) || info.velocity.x;
    const direction = getSwipeCommit(distance, velocity, width);
    if (direction === 0) {
      // Not far enough: spring back
      void animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
      return;
    }
    setIsRemoving(true);
    void animate(x, direction * (width + 24), { duration: 0.2, ease: "easeIn" }).then(onRemove);
  };

  return (
    <Reorder.Item
      value={job._id}
      dragListener={false}
      dragControls={reorderControls}
      onDragEnd={onReorderEnd}
      data-stop-id={job._id}
      className="relative overflow-hidden rounded-2xl shadow-sm"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
    >
      {/* What the swipe does, revealed behind the card as it slides */}
      <motion.div
        aria-hidden
        style={{ opacity: backdropOpacity }}
        className={cn(
          "absolute inset-0 flex items-center justify-between px-4 text-white transition-colors duration-150",
          isArmed ? "bg-red-700" : "bg-red-600",
        )}
      >
        <SwipeLabel opacity={leftLabelOpacity} isArmed={isArmed} />
        <SwipeLabel opacity={rightLabelOpacity} isArmed={isArmed} />
      </motion.div>

      <motion.div
        ref={cardRef}
        style={{ x }}
        drag="x"
        dragListener={false}
        dragControls={swipeControls}
        dragDirectionLock
        dragMomentum={false}
        onDragEnd={handleSwipeEnd}
        className="relative overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className={cn("flex items-stretch", isDone && "bg-muted/40")}>
          {/* Drag handle: up and down only */}
          <div
            onPointerDown={(event) => reorderControls.start(event)}
            aria-label={`Drag to move stop ${stopNumber}`}
            className="flex w-14 shrink-0 cursor-grab touch-none select-none flex-col items-center justify-center bg-muted/30 active:cursor-grabbing"
          >
            <GripVertical size={22} className="text-muted-foreground" />
            <div
              className={cn(
                "mt-2 flex size-8 items-center justify-center rounded-full text-base font-bold",
                isDone ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary",
              )}
            >
              {isDone ?
                <Check size={18} strokeWidth={3} aria-label="Done" />
              : stopNumber}
            </div>
          </div>

          {/* Card body: tap opens the job, sideways swipe removes it, up and down scrolls */}
          <div
            onPointerDown={handleBodyPointerDown}
            onPointerMove={handleBodyPointerMove}
            onPointerUp={handleBodyPointerUp}
            onClick={handleBodyClick}
            className={cn(
              "min-w-0 flex-1 cursor-pointer touch-pan-y select-none",
              isDone && "opacity-60",
            )}
          >
            <RouteJobCard
              job={job}
              className="rounded-none border-0 bg-transparent shadow-none"
              showRouteDetails
              showForecast={!isDone}
              arrivalTime={isDone ? undefined : arrivalTime}
              weatherNote={isDone ? undefined : weatherNote}
            />
          </div>
        </div>
      </motion.div>
    </Reorder.Item>
  );
}

interface SwipeLabelProps {
  opacity: MotionValue<number>;
  isArmed: boolean;
}

function SwipeLabel({ opacity, isArmed }: SwipeLabelProps) {
  return (
    <motion.div
      style={{ opacity }}
      className="flex w-28 flex-col items-center gap-1 text-center text-lg font-black leading-tight"
    >
      <CircleMinus
        size={32}
        strokeWidth={2.5}
        className={cn("transition-transform duration-150", isArmed && "scale-125")}
      />
      Remove from route
    </motion.div>
  );
}
