import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export interface Option {
  label: string;
  value: string;
}

export interface ToggleSwitchProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}

const container = cva([
  "relative inline-flex select-none overflow-hidden",
  "rounded-xl border-2 border-foreground backdrop-blur-md",
]);

const labelBase =
  "relative z-10 flex-shrink-0 origin-center px-3 py-2 text-center " +
  "text-sm font-medium uppercase tracking-wide " +
  "pointer-events-none";

const thumbShadow = "shadow-[0_6px_20px_theme(colors.primary/0.35)]";

const PRESS_SCALE = 0.88;
const MUTED_OPACITY = 0.65;

const SPRING_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SPRING_DURATION = "450ms";

export const ToggleSwitch = React.forwardRef<HTMLDivElement, ToggleSwitchProps>(
  (props, forwardRef) => {
    const { options, value, onChange, className, ...rest } = props;

    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const labelRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const thumbRef = React.useRef<HTMLDivElement>(null);

    const [segments, setSegments] = React.useState<
      { offset: number; width: number }[]
    >([]);
    const [scale, setScale] = React.useState(1);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isPressed, setIsPressed] = React.useState(false);
    const [hoveredLabelIndex, setHoveredLabelIndex] = React.useState<
      number | null
    >(null);
    const [dragStartX, setDragStartX] = React.useState(0);
    const [thumbStartX, setThumbStartX] = React.useState(0);

    const measure = React.useCallback(() => {
      const segs = labelRefs.current.map((el) =>
        el
          ? { offset: el.offsetLeft, width: el.offsetWidth }
          : { offset: 0, width: 0 },
      );
      setSegments(segs);

      const totalLabelsWidth = segs.reduce((acc, s) => acc + s.width, 0);
      const containerWidth =
        wrapperRef.current?.offsetWidth ?? totalLabelsWidth;

      if (totalLabelsWidth > containerWidth) {
        setScale(containerWidth / totalLabelsWidth);
      } else {
        setScale(1);
      }
    }, []);

    React.useLayoutEffect(() => {
      measure();
      const ro = new ResizeObserver(measure);
      if (wrapperRef.current) ro.observe(wrapperRef.current);
      labelRefs.current.forEach((el) => el && ro.observe(el));

      return () => ro.disconnect();
    }, [measure, options.length]);

    const scaledSegments = React.useMemo(
      () =>
        segments.map((s) => ({
          offset: s.offset * scale,
          width: s.width * scale,
        })),
      [segments, scale],
    );

    const activeIdx = React.useMemo(
      () => options.findIndex((o) => o.value === value),
      [options, value],
    );

    const nearestIdx = React.useCallback(
      (x: number) => {
        if (!scaledSegments.length) return 0;
        const centres = scaledSegments.map((s) => s.offset + s.width / 2);
        return centres.reduce(
          (best, c, i) =>
            Math.abs(c - x) < Math.abs(centres[best] - x) ? i : best,
          0,
        );
      },
      [scaledSegments],
    );

    React.useEffect(() => {
      if (!scaledSegments.length || !thumbRef.current || isDragging) return;

      const thumb = thumbRef.current;
      const targetSegment = scaledSegments[activeIdx];

      thumb.style.transform = `translateX(${targetSegment.offset}px)`;
      thumb.style.width = `${targetSegment.width}px`;
    }, [scaledSegments, activeIdx, isDragging]);

    const constraints = React.useMemo(() => {
      if (!scaledSegments.length) return { left: 0, right: 0 };
      const lastSegment = scaledSegments[scaledSegments.length - 1];
      return {
        left: scaledSegments[0].offset,
        right: lastSegment.offset,
      };
    }, [scaledSegments]);

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!wrapperRef.current || !thumbRef.current) return;

        const currentTransform = thumbRef.current.style.transform;

        const translateMatch = currentTransform.match(
          /translateX\(([^)]+)px\)/,
        );
        const currentX = translateMatch
          ? parseFloat(translateMatch[1])
          : scaledSegments[activeIdx]?.offset || 0;

        setIsDragging(true);
        setIsPressed(true);
        setDragStartX(e.clientX);
        setThumbStartX(currentX);

        e.preventDefault();
      },
      [scaledSegments, activeIdx],
    );

    const handleMouseMove = React.useCallback(
      (e: MouseEvent) => {
        if (!isDragging || !wrapperRef.current || !thumbRef.current) return;

        const deltaX = e.clientX - dragStartX;
        let newX = thumbStartX + deltaX;

        const elasticFactor = 0.2;
        const leftBound = constraints.left;
        const rightBound = constraints.right;

        if (newX < leftBound) {
          const overshoot = leftBound - newX;
          newX = leftBound - overshoot * elasticFactor;
        } else if (newX > rightBound) {
          const overshoot = newX - rightBound;
          newX = rightBound + overshoot * elasticFactor;
        }

        thumbRef.current.style.transition = "none";
        thumbRef.current.style.transform = `translateX(${newX}px) scale(${PRESS_SCALE})`;

        const rect = wrapperRef.current.getBoundingClientRect();
        const currentHoveredIdx = nearestIdx((e.clientX - rect.left) / scale);

        if (currentHoveredIdx !== hoveredLabelIndex) {
          setHoveredLabelIndex(currentHoveredIdx);
        }
      },
      [
        isDragging,
        dragStartX,
        thumbStartX,
        constraints,
        nearestIdx,
        hoveredLabelIndex,
        scale,
      ],
    );

    const handleMouseUp = React.useCallback(
      (e: MouseEvent) => {
        if (!isDragging || !wrapperRef.current || !thumbRef.current) return;

        setIsDragging(false);
        setIsPressed(false);
        setHoveredLabelIndex(null);

        const rect = wrapperRef.current.getBoundingClientRect();
        const idx = nearestIdx((e.clientX - rect.left) / scale);

        const thumb = thumbRef.current;
        thumb.style.transition = `all ${SPRING_DURATION} ${SPRING_EASING}`;
        thumb.style.transform = `translateX(${scaledSegments[idx].offset}px) scale(1)`;
        thumb.style.width = `${scaledSegments[idx].width}px`;

        if (options[idx].value !== value) {
          onChange(options[idx].value);
        }
      },
      [isDragging, nearestIdx, scaledSegments, options, value, onChange, scale],
    );

    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleTap = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!wrapperRef.current || isDragging) return;

        const rect = wrapperRef.current.getBoundingClientRect();
        const idx = nearestIdx((e.clientX - rect.left) / scale);

        if (options[idx].value !== value) {
          onChange(options[idx].value);
        }
      },
      [nearestIdx, options, value, onChange, scale, isDragging],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = Math.max(0, Math.min(activeIdx + dir, options.length - 1));
      onChange(options[next].value);
    };

    return (
      <div
        {...rest}
        ref={(node) => {
          wrapperRef.current = node;
          if (typeof forwardRef === "function") {
            forwardRef(node);
          } else if (forwardRef) {
            (
              forwardRef as React.MutableRefObject<HTMLDivElement | null>
            ).current = node;
          }
        }}
        role="radiogroup"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(container(), "cursor-pointer", className)}
        onClick={handleTap}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "left center",
            width: scale < 1 ? `${100 / scale}%` : "100%",
            display: "flex",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            ref={thumbRef}
            aria-hidden
            className={cn(
              "absolute top-0 h-full rounded-md bg-primary",
              thumbShadow,
              "z-1",
            )}
            style={{
              transition: isDragging
                ? "none"
                : `all ${SPRING_DURATION} ${SPRING_EASING}`,
              transform:
                scaledSegments.length > 0
                  ? `translateX(${scaledSegments[activeIdx]?.offset || 0}px) scale(${isPressed ? PRESS_SCALE : 1})`
                  : "translateX(0px) scale(1)",
              width:
                scaledSegments.length > 0
                  ? `${scaledSegments[activeIdx]?.width || 0}px`
                  : "0px",
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={handleMouseDown}
          />

          {options.map((o, i) => (
            <div
              key={o.value}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              role="radio"
              aria-checked={o.value === value}
              className={cn(labelBase, {
                "text-primary-foreground": i === activeIdx,
                "text-muted-foreground": i !== activeIdx,
              })}
              style={{
                transition: `all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
                transform: `scale(${i === hoveredLabelIndex ? 1.15 : 1})`,
                opacity:
                  i === activeIdx || i === hoveredLabelIndex
                    ? 1
                    : MUTED_OPACITY,
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      </div>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
