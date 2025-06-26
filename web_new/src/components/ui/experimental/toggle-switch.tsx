import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
} from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                Interfaces                                  */
/* -------------------------------------------------------------------------- */

export interface Option {
  label: string;
  value: string;
}

export interface ToggleSwitchProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

/* -------------------------------------------------------------------------- */
/*                                   Style                                    */
/* -------------------------------------------------------------------------- */

const container = cva([
  "relative inline-flex select-none overflow-hidden",
  "rounded-full border-2 border-primary bg-muted/70 backdrop-blur-md",
]);

const labelBase =
  "relative z-10 flex-shrink-0 px-5 py-2 text-center " +
  "text-sm font-medium uppercase tracking-wide " +
  "transition-[color,transform] duration-150 ease-out";

const thumbShadow = "shadow-[0_6px_20px_theme(colors.primary/0.35)]"; // Tailwind safe

const SPRING = { stiffness: 1000, damping: 45, mass: 0.3 };

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

export const ToggleSwitch = React.forwardRef<HTMLDivElement, ToggleSwitchProps>(
  (props, ref) => {
    const { options, value, onChange, className, ...rest } = props;

    /* ---------------------------- layout vars -------------------------------- */

    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const labelRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const [widths, setWidths] = React.useState<number[]>([]);
    const [offsets, setOffsets] = React.useState<number[]>([]);

    const measure = React.useCallback(() => {
      const w = labelRefs.current.map((el) =>
        el ? el.getBoundingClientRect().width : 0,
      );
      const o: number[] = [];
      w.reduce((acc, cur, i) => {
        o[i] = acc;
        return acc + cur;
      }, 0);
      setWidths(w);
      setOffsets(o);
    }, []);

    React.useLayoutEffect(() => {
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }, [measure, options.length]);

    /* ------------------------------ motion ----------------------------------- */

    const x = useMotionValue(0); // raw x
    const xSpring = useSpring(x, SPRING);

    const w = useMotionValue(0); // raw width
    const wSpring = useSpring(w, SPRING);

    const scale = useMotionValue(1);

    const ctrlX = React.useRef<ReturnType<typeof animate> | null>(null);
    const ctrlW = React.useRef<ReturnType<typeof animate> | null>(null);

    /* ------------------------------- helpers --------------------------------- */

    const idxByValue = React.useCallback(
      (val: string) => options.findIndex((o) => o.value === val),
      [options],
    );
    const clampIdx = React.useCallback(
      (i: number) => Math.max(0, Math.min(i, options.length - 1)),
      [options.length],
    );

    const activeIdx = idxByValue(value);

    /* ---------------------------- derived index ------------------------------ */

    const nearestIdxFromX = React.useCallback(
      (pos: number) => {
        if (!offsets.length) return 0;
        // find label whose centre is closest
        const centres = offsets.map((off, i) => off + widths[i] / 2);
        const nearest = centres.reduce(
          (best, c, i) =>
            Math.abs(c - (pos + widths[activeIdx] / 2)) <
              Math.abs(centres[best] - (pos + widths[activeIdx] / 2))
              ? i
              : best,
          0,
        );
        return nearest;
      },
      [offsets, widths, activeIdx],
    );

    const [hintIdx, setHintIdx] = React.useState(activeIdx);

    useMotionValueEvent(xSpring, "change", (latest) => {
      setHintIdx(nearestIdxFromX(latest));
    });

    /* ----------------------- external value sync ----------------------------- */

    React.useEffect(() => {
      if (!offsets.length) return;
      ctrlX.current?.stop();
      ctrlW.current?.stop();

      ctrlX.current = animate(x, offsets[activeIdx], {
        type: "spring",
        ...SPRING,
      });
      ctrlW.current = animate(w, widths[activeIdx], {
        type: "spring",
        ...SPRING,
      });
    }, [activeIdx, offsets, widths, x, w]);

    /* ----------------------------- dragging ---------------------------------- */

    const dragging = React.useRef(false);
    const moved = React.useRef(false);
    const start = React.useRef({ px: 0, ox: 0 });

    const pressIn = () => {
      animate(scale, 0.88, { duration: 0.15 });
    };
    const pressOut = () => {
      animate(scale, 1, { duration: 0.15 });
    };

    const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (!wrapperRef.current) return;
      wrapperRef.current.setPointerCapture(e.pointerId);
      dragging.current = true;
      moved.current = false;
      start.current = { px: e.clientX, ox: x.get() };
      ctrlX.current?.stop();
      ctrlW.current?.stop();
      pressIn();
    };

    const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - start.current.px;
      if (Math.abs(delta) > 2) moved.current = true;

      const nextX = start.current.ox + delta;
      const minX = -32;
      const maxX = offsets[offsets.length - 1] + 32;
      x.set(Math.max(minX, Math.min(maxX, nextX)));

      // squish proportional to overshoot
      const overshoot = Math.max(-nextX, nextX - offsets[offsets.length - 1]);
      scale.set(1 - Math.min(Math.abs(overshoot) / 32, 0.3));
    };

    const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      pressOut();
      wrapperRef.current?.releasePointerCapture(e.pointerId);

      let idx: number;

      if (!moved.current) {
        // treat as click – figure out which segment was clicked
        const rect = wrapperRef.current!.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        idx = clampIdx(offsets.findIndex((off, i) => clickX < off + widths[i]));
      } else {
        idx = hintIdx;
      }

      ctrlX.current = animate(x, offsets[idx], { type: "spring", ...SPRING });
      ctrlW.current = animate(w, widths[idx], { type: "spring", ...SPRING });

      if (options[idx].value !== value) onChange(options[idx].value);
    };

    /* ---------------------------- keyboard nav ------------------------------- */

    const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      onChange(options[clampIdx(activeIdx + dir)].value);
    };

    /* ------------------------------ render ----------------------------------- */

    return (
      <div
        {...rest}
        ref={(node) => {
          wrapperRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref)
            (ref as React.MutableRefObject<HTMLDivElement | null>).current =
              node;
        }}
        role="radiogroup"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(container(), className)}
      >
        {/* Thumb ---------------------------------------------------------------- */}
        <motion.div
          aria-hidden
          className={cn(
            "absolute top-0 h-full rounded-full bg-primary",
            thumbShadow,
          )}
          style={{
            x: xSpring,
            width: wSpring,
            scaleX: scale,
            transformOrigin: "center",
            willChange: "transform",
          }}
        >
          {/* floating index indicator */}
          <motion.span
            className="absolute inset-0 flex items-center justify-center select-none
                     text-xs font-semibold text-primary-foreground pointer-events-none"
            style={{ opacity: moved.current ? 1 : 0 }}
          >
            {options[hintIdx]?.label}
          </motion.span>
        </motion.div>

        {/* Labels --------------------------------------------------------------- */}
        {options.map((o, i) => (
          <div
            key={o.value}
            ref={(el) => (labelRefs.current[i] = el)}
            role="radio"
            aria-checked={o.value === value}
            className={cn(labelBase, {
              "text-primary-foreground": i === activeIdx,
              "text-muted-foreground": i !== activeIdx,
              "scale-105": i === hintIdx,
            })}
          >
            {o.label}
          </div>
        ))}
      </div>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
