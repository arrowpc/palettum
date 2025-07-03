import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  content: string;
  enabled?: boolean;
  children: React.ReactElement;
}

const TooltipWrapper: React.FC<Props> = ({
  enabled = true,
  content,
  children,
}) =>
  enabled ? (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  ) : (
    children
  );

export default TooltipWrapper;
