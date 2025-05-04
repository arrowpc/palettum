import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Enhanced Slider with support for custom track gradients
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    trackClassName?: string;
  }
>(({ className, trackClassName, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex touch-none select-none",
      props.orientation === "vertical"
        ? "h-full flex-col items-center"
        : "w-full items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        "overflow-hidden rounded-full",
        props.orientation === "vertical"
          ? "w-[8px] h-full"
          : "h-1.5 w-full",
        trackClassName || "bg-primary/20"
      )}
    >
      <SliderPrimitive.Range
        className={cn(
          "absolute",
          props.orientation === "vertical"
            ? "w-full bottom-0"
            : "h-full left-0",
          !trackClassName && "bg-primary"
        )}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-primary/50 bg-background shadow-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));

Slider.displayName = SliderPrimitive.Root.displayName;

// Main component
const LabColorControls = () => {
  // Using your existing variables and handlers
  const [currentLabScales, setCurrentLabScales] = React.useState([1.0, 1.0, 1.0]);
  
  const handleLabScaleChange = (index: 0 | 1 | 2, value: number) => {
    const newScales = [...currentLabScales];
    newScales[index] = value;
    setCurrentLabScales(newScales);
  };

  const handleInputChange = (index: 0 | 1 | 2, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= MIN_SMOOTHED_SCALE && numValue <= MAX_SMOOTHED_SCALE) {
      handleLabScaleChange(index, numValue);
    }
  };

  const MIN_SMOOTHED_SCALE = 0.1;
  const MAX_SMOOTHED_SCALE = 2.0;
  const SMOOTHED_SCALE_STEP = 0.1;
  const DEFAULT_SMOOTHED_SCALE = 1.0;
  const usesSmoothed = true;

  return (
    <div className="space-y-4">
      <Label className="block text-center text-lg font-medium">
        Lab Color Component Controls
      </Label>
      <div className="grid grid-cols-3 gap-6 p-4 rounded-lg bg-muted/20">
        {[
          { 
            name: "Lightness", 
            key: "L", 
            index: 0,
            gradient: "bg-gradient-to-t from-black via-gray-500 to-white"
          },
          { 
            name: "Green-Red", 
            key: "a", 
            index: 1,
            gradient: "bg-gradient-to-t from-green-500 to-red-500"
          },
          { 
            name: "Blue-Yellow", 
            key: "b", 
            index: 2,
            gradient: "bg-gradient-to-t from-blue-500 to-yellow-400"
          },
        ].map(({ name, key, index, gradient }) => (
          <div key={index} className="flex flex-col items-center">
            <div className="w-full text-center mb-2">
              <Label className="text-sm font-medium">
                {name} <span className="text-primary font-bold">({key})</span>
              </Label>
            </div>
            
            <div className="relative h-48 w-full flex justify-center items-center">
              <div className="h-40 w-12 relative flex justify-center">
                {/* Gradient background for track */}
                <div className={`absolute h-full w-[8px] rounded-full ${gradient} opacity-80`}></div>
                
                <Slider
                  orientation="vertical"
                  min={MIN_SMOOTHED_SCALE}
                  max={MAX_SMOOTHED_SCALE}
                  step={SMOOTHED_SCALE_STEP}
                  value={[currentLabScales[index]]}
                  onValueChange={(v) => handleLabScaleChange(index as 0 | 1 | 2, v[0])}
                  disabled={!usesSmoothed}
                  trackClassName="bg-transparent"
                />
              </div>
            </div>
            
            <div className="w-full mt-2 flex flex-col items-center">
              <div className="mb-1 text-xs text-center">
                {currentLabScales[index] === DEFAULT_SMOOTHED_SCALE && (
                  <span className="text-xs text-muted-foreground">Default</span>
                )}
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-sm">×</span>
                <Input
                  type="number"
                  min={MIN_SMOOTHED_SCALE}
                  max={MAX_SMOOTHED_SCALE}
                  step={SMOOTHED_SCALE_STEP}
                  value={currentLabScales[index]}
                  onChange={(e) => handleInputChange(index as 0 | 1 | 2, e.target.value)}
                  className="h-8 w-16 text-center"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Adjust the influence of each Lab color component to fine-tune color relationships.
      </p>
    </div>
  );
};

export { LabColorControls };
