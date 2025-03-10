import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface ImageTransparencyProps {
  file: File | null;
  transThreshold: (value: number) => void;
}

const ImageTransparency: React.FC<ImageTransparencyProps> = ({
  file,
  transThreshold,
}) => {
  const [enabled, setEnabled] = useState(false); // Tracks if the checkbox should be enabled
  const [checked, setChecked] = useState(false); // Tracks whether the user has checked the box

  useEffect(() => {
    if (!file) {
      setEnabled(false);
      setChecked(false);
      transThreshold(255);
      return;
    }

    // TODO: Attempt to actually check GIF transparency
    if (file.type === "image/gif") {
      setEnabled(true);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setEnabled(false);
        URL.revokeObjectURL(url);
        return;
      }

      ctx.drawImage(img, 0, 0, img.width, img.height);

      try {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        let hasAlpha = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            hasAlpha = true;
            break;
          }
        }
        if (!hasAlpha) {
          setEnabled(false);
          setChecked(false);
        } else {
          setEnabled(true);
          transThreshold(checked ? 255 : 0);
        }
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error reading image data", error);
        setEnabled(false);
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      setEnabled(false);
      URL.revokeObjectURL(url);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, transThreshold]);

  const handleCheckedChange = (newChecked: boolean) => {
    setChecked(newChecked);
    transThreshold(newChecked ? 255 : 0);
  };

  return (
    <div className="flex items-start space-x-3">
      <Checkbox
        id="transparency"
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={!enabled}
        className="mt-1"
      />
      <div className="flex flex-col peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
        <label
          htmlFor="transparency"
          className="text-lg font-medium text-foreground leading-none cursor-pointer"
        >
          Preserve Transparency
        </label>
        <p className="text-sm text-foreground-secondary mt-1.5">
          Transparent pixels will not be palettified
        </p>
      </div>
    </div>
  );
};

export default ImageTransparency;
