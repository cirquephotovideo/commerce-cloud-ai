import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";

interface EnrichmentStatusIndicatorProps {
  status?: string | null;
  label?: string;
  onClick?: () => void;
}

export const EnrichmentStatusIndicator = ({ status, label, onClick }: EnrichmentStatusIndicatorProps) => {
  const baseClasses = onClick ? "cursor-pointer hover:scale-105 transition-transform" : "";
  
  const renderBadge = (badge: React.ReactNode) => {
    if (!onClick) return badge;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>Cliquer pour voir les détails</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  if (status === 'completed') {
    return renderBadge(
      <Badge 
        className={`bg-green-500 hover:bg-green-600 text-white gap-1 ${baseClasses}`}
        onClick={onClick}
      >
        <CheckCircle2 className="w-3 h-3" />
        {label ? `${label} ✓` : 'Complété'}
      </Badge>
    );
  }
  
  if (status === 'processing') {
    return renderBadge(
      <Badge 
        variant="secondary" 
        className={`bg-yellow-500 hover:bg-yellow-600 text-white gap-1 ${baseClasses}`}
        onClick={onClick}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        {label ? `${label} ⏳` : 'En cours'}
      </Badge>
    );
  }
  
  if (status === 'failed') {
    return renderBadge(
      <Badge 
        variant="destructive" 
        className={`gap-1 ${baseClasses}`}
        onClick={onClick}
      >
        <XCircle className="w-3 h-3" />
        {label ? `${label} ✗` : 'Échec'}
      </Badge>
    );
  }
  
  return renderBadge(
    <Badge 
      variant="outline" 
      className={`gap-1 text-muted-foreground ${baseClasses}`}
      onClick={onClick}
    >
      <Clock className="w-3 h-3" />
      {label ? `${label} ⏸` : 'Manquant'}
    </Badge>
  );
};
