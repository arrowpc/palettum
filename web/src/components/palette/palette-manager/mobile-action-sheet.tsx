import { Copy, Download, Edit2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { type Palette } from "palettum";
import { type LucideIcon } from "lucide-react";

interface Props {
  palette: Palette | null;
  onClose: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const MobileActionSheet: React.FC<Props> = ({
  palette,
  onClose,
  onDuplicate,
  onExport,
  onEdit,
  onDelete,
}) => {
  useLockBodyScroll(!!palette);

  if (!palette) return null;

  const disabled = palette.kind === "Default";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-background rounded-t-2xl p-4 shadow-lg translate-y-full transition-transform",
          "will-change-transform",
          palette && "translate-y-0",
        )}
        style={{ transitionDuration: `200ms` }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium truncate">{palette.id}</span>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <SheetButton icon={Copy} onClick={onDuplicate}>
            Duplicate
          </SheetButton>
          <SheetButton icon={Download} onClick={onExport}>
            Export
          </SheetButton>
          <SheetButton icon={Edit2} onClick={onEdit} disabled={disabled}>
            Edit
          </SheetButton>
          <SheetButton icon={Trash2} onClick={onDelete} disabled={disabled}>
            Delete
          </SheetButton>
        </div>
      </div>
    </div>
  );
};

export default MobileActionSheet;

const SheetButton: React.FC<
  React.PropsWithChildren<{
    icon: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
  }>
> = ({ icon: Icon, onClick, disabled, children }) => (
  <button
    className={cn(
      "flex items-center gap-2 px-3 py-2 rounded",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary",
    )}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
  >
    <Icon className="w-4 h-4" />
    {children}
  </button>
);
