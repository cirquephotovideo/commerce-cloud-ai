import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useProductTour } from "@/hooks/useProductTour";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TourLaunchButton() {
  const { startTour, hasCompletedTour } = useProductTour();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={startTour}
            className="relative"
          >
            <HelpCircle className="h-4 w-4" />
            {!hasCompletedTour && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Lancer le tour guidé</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
