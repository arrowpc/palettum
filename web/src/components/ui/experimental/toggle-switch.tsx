import * as React from "react";
import { animate, motion, type PanInfo, useMotionValue } from "framer-motion";
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

const SPRING = {
  type: "spring" as const,
  stiffness: 550,
  damping: 46,
  mass: 0.35,
};

const PRESS_SCALE = 0.88;
const MUTED_OPACITY = 0.65;
export const ToggleSwitch = React.forwardRef<HTMLDivElement, ToggleSwitchProps>(
  (props, forwardRef) => {
    const { options, value, onChange, className, ...rest } = props;

    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const labelRefs = React.useRef<(HTMLDivElement | null)[]>([]);

    const [segments, setSegments] = React.useState<
      { offset: number; width: number }[]
    >([]);
    const [scale, setScale] = React.useState(1);

    const [hoveredLabelIndex, setHoveredLabelIndex] = React.useState<
      number | null
    >(null);

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

    const mvX = useMotionValue(0);
    const mvW = useMotionValue(0);

    React.useEffect(() => {
      if (!scaledSegments.length) return;
      animate(mvX, scaledSegments[activeIdx].offset, SPRING as any);
      animate(mvW, scaledSegments[activeIdx].width, SPRING as any);
    }, [scaledSegments, activeIdx, mvX, mvW]);

    const constraints = React.useMemo(() => {
      if (!scaledSegments.length) return { left: 0, right: 0 };
      return {
        left: scaledSegments[0].offset,
        right: scaledSegments[scaledSegments.length - 1].offset,
      };
    }, [scaledSegments]);

    const handleDrag = React.useCallback(
      (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!wrapperRef.current) return;
        const left = wrapperRef.current.getBoundingClientRect().left;
        const currentHoveredIdx = nearestIdx((info.point.x - left) / scale);
        if (currentHoveredIdx !== hoveredLabelIndex) {
          setHoveredLabelIndex(currentHoveredIdx);
        }
      },
      [nearestIdx, hoveredLabelIndex, scale],
    );

    const handleDragEnd = React.useCallback(
      (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!wrapperRef.current) return;
        const left = wrapperRef.current.getBoundingClientRect().left;
        const idx = nearestIdx((info.point.x - left) / scale);

        animate(mvX, scaledSegments[idx].offset, SPRING as any);
        animate(mvW, scaledSegments[idx].width, SPRING as any);

        setHoveredLabelIndex(null);

        if (options[idx].value !== value) onChange(options[idx].value);
      },
      [nearestIdx, scaledSegments, mvX, mvW, options, value, onChange, scale],
    );

    const handleTap = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!wrapperRef.current) return;
        const left = wrapperRef.current.getBoundingClientRect().left;
        const idx = nearestIdx((e.clientX - left) / scale);

        animate(mvX, scaledSegments[idx].offset, SPRING as any);
        animate(mvW, scaledSegments[idx].width, SPRING as any);

        if (options[idx].value !== value) onChange(options[idx].value);
      },
      [nearestIdx, scaledSegments, mvX, mvW, options, value, onChange, scale],
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
          <motion.div
            aria-hidden
            className={cn(
              "absolute top-0 h-full rounded-md bg-primary",
              thumbShadow,
              "z-1",
            )}
            style={{ x: mvX, width: mvW }}
            drag="x"
            dragConstraints={constraints}
            dragElastic={0.2}
            dragMomentum={false}
            whileTap={{ scale: PRESS_SCALE }}
            whileDrag={{ scale: PRESS_SCALE }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
          />

          {options.map((o, i) => (
            <motion.div
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
              initial={false}
              animate={{
                scale: i === hoveredLabelIndex ? 1.15 : 1,
                opacity:
                  i === activeIdx || i === hoveredLabelIndex
                    ? 1
                    : MUTED_OPACITY,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                mass: 0.8,
              }}
            >
              {o.label}
            </motion.div>
          ))}
        </div>
      </div>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
