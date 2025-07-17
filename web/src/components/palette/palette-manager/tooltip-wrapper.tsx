import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  content: string;
  enabled?: boolean;
  shouldRender?: boolean;
  children: React.ReactElement;
}

const TooltipWrapper: React.FC<Props> = React.memo(
  ({ enabled = true, shouldRender = true, content, children }) => {
    if (!enabled || !shouldRender) {
      return children;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    );
  },
);

export default TooltipWrapper;
