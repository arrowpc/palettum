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

    const [hoveredLabelIndex, setHoveredLabelIndex] = React.useState<
      number | null
    >(null);

    const measure = React.useCallback(() => {
      setSegments(
        labelRefs.current.map((el) =>
          el
            ? { offset: el.offsetLeft, width: el.offsetWidth }
            : { offset: 0, width: 0 },
        ),
      );
    }, []);

    React.useLayoutEffect(() => {
      measure();
      const ro = new ResizeObserver(measure);
      if (wrapperRef.current) ro.observe(wrapperRef.current);
      labelRefs.current.forEach((el) => el && ro.observe(el));

      return () => ro.disconnect();
    }, [measure, options.length]);

    const activeIdx = React.useMemo(
      () => options.findIndex((o) => o.value === value),
      [options, value],
    );

    const nearestIdx = React.useCallback(
      (x: number) => {
        if (!segments.length) return 0;
        const centres = segments.map((s) => s.offset + s.width / 2);
        return centres.reduce(
          (best, c, i) =>
            Math.abs(c - x) < Math.abs(centres[best] - x) ? i : best,
          0,
        );
      },
      [segments],
    );

    const mvX = useMotionValue(0);
    const mvW = useMotionValue(0);

    React.useEffect(() => {
      if (!segments.length) return;
      animate(mvX, segments[activeIdx].offset, SPRING as any);
      animate(mvW, segments[activeIdx].width, SPRING as any);
    }, [segments, activeIdx, mvX, mvW]);

    const constraints = React.useMemo(() => {
      if (!segments.length) return { left: 0, right: 0 };
      return {
        left: segments[0].offset,
        right: segments[segments.length - 1].offset,
      };
    }, [segments]);

    const handleDrag = React.useCallback(
      (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!wrapperRef.current) return;
        const left = wrapperRef.current.getBoundingClientRect().left;
        const currentHoveredIdx = nearestIdx(info.point.x - left);
        if (currentHoveredIdx !== hoveredLabelIndex) {
          setHoveredLabelIndex(currentHoveredIdx);
        }
      },
      [nearestIdx, hoveredLabelIndex],
    );

    const handleDragEnd = React.useCallback(
      (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!wrapperRef.current) return;
        const left = wrapperRef.current.getBoundingClientRect().left;
        const idx = nearestIdx(info.point.x - left);

        animate(mvX, segments[idx].offset, SPRING as any);
        animate(mvW, segments[idx].width, SPRING as any);

        setHoveredLabelIndex(null);

        if (options[idx].value !== value) onChange(options[idx].value);
      },
      [nearestIdx, segments, mvX, mvW, options, value, onChange],
    );

    const handleTap = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!wrapperRef.current) return;
        const left = wrapperRef.current.getBoundingClientRect().left;
        const idx = nearestIdx(e.clientX - left);

        animate(mvX, segments[idx].offset, SPRING as any);
        animate(mvW, segments[idx].width, SPRING as any);

        if (options[idx].value !== value) onChange(options[idx].value);
      },
      [nearestIdx, segments, mvX, mvW, options, value, onChange],
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
            (forwardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        }}
        role="radiogroup"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(container(), "cursor-pointer", className)}
        onClick={handleTap}
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
                i === activeIdx || i === hoveredLabelIndex ? 1 : MUTED_OPACITY,
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
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
