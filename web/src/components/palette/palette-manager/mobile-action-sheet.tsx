import { Copy, Download, Edit2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import type { Palette } from "palettum";

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

  const actions = [
    { icon: Copy, onClick: onDuplicate, label: "Duplicate" },
    { icon: Download, onClick: onExport, label: "Export" },
    {
      icon: Edit2,
      onClick: onEdit,
      label: "Edit",
      disabled: palette.kind === "Default",
    },
    {
      icon: Trash2,
      onClick: onDelete,
      label: "Delete",
      disabled: palette.kind === "Default",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full bg-card rounded-t-xl shadow-lg transform transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-medium text-foreground truncate">{palette.id}</h3>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {actions.map(({ icon: Icon, onClick, label, disabled }) => (
            <button
              key={label}
              onClick={disabled ? undefined : onClick}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                disabled
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileActionSheet;
